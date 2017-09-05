'use strict';

var nconf = require('nconf');
//nconf.argv().env();

var chai = require('chai');
var expect = require('chai').expect;

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var vendSdk = require('./../vend')({
  debugRequests: process.env.REQUEST_LOG_LEVEL_FOR_VEND_NODEJS_SDK || false // flip it to true to see detailed request/response logs
});
var _ = require('underscore');
var Promise = require('bluebird');

var cachedConnectionInfo;
var getConnectionInfo = function (noCache) {
  if (!noCache) {
    if (!cachedConnectionInfo) {
      cachedConnectionInfo = {
        domainPrefix: nconf.get('domain_prefix'),
        accessToken: nconf.get('access_token'),
        refreshToken: nconf.get('refresh_token'),
        vendTokenService: nconf.get('vend:token_service'),
        vendClientId: nconf.get('vend:client_id'),
        vendClientSecret: nconf.get('vend:client_secret')
      };
    }
    return cachedConnectionInfo;
  }
  else {
    return {
      domainPrefix: nconf.get('domain_prefix'),
      accessToken: nconf.get('access_token'),
      refreshToken: nconf.get('refresh_token'),
      vendTokenService: nconf.get('vend:token_service'),
      vendClientId: nconf.get('vend:client_id'),
      vendClientSecret: nconf.get('vend:client_secret')
    };
  }
};

describe('vend-nodejs-sdk', function () {

  describe('requires proper configuration to run tests', function () {
    it('NODE_ENV must be set', function () {
      expect(process.env.NODE_ENV).to.exist;
      expect(process.env.NODE_ENV).to.be.a('string');
      expect(process.env.NODE_ENV).to.not.be.empty;
    });
    it('a file with client data must be available', function () {
      nconf.file('config', {file: 'config/' + process.env.NODE_ENV + '.json'});

      expect(nconf.get('vend:token_service')).to.exist;
      expect(nconf.get('vend:token_service')).to.be.a('string');
      expect(nconf.get('vend:token_service')).to.not.be.empty;

      expect(nconf.get('vend:client_id')).to.exist;
      expect(nconf.get('vend:client_id')).to.be.a('string');
      expect(nconf.get('vend:client_id')).to.not.be.empty;

      expect(nconf.get('vend:client_secret')).to.exist;
      expect(nconf.get('vend:client_secret')).to.be.a('string');
      expect(nconf.get('vend:client_secret')).to.not.be.empty;
    });
    it('a file with oauth data must be available', function () {
      nconf.file('oauth', {file: 'config/oauth.json'});

      expect(nconf.get('domain_prefix')).to.exist;
      expect(nconf.get('domain_prefix')).to.be.a('string');
      expect(nconf.get('domain_prefix')).to.not.be.empty;

      expect(nconf.get('refresh_token')).to.exist;
      expect(nconf.get('refresh_token')).to.be.a('string');
      expect(nconf.get('refresh_token')).to.not.be.empty;
    });
  });

  describe('when refreshToken is unavailable', function () {

    it('should fail when accessToken is missing', function () {

      var args = vendSdk.args.products.fetch();
      args.page.value = 1;
      args.pageSize.value = 5;

      var connectionInfo = {
        domainPrefix: nconf.get('domain_prefix')
      };

      /* short hand for testing */
      //var unresolvedPromise = vendSdk.products.fetch(args, connectionInfo);
      //return expect(unresolvedPromise).to.be.rejectedWith('missing required arguments for sendRequest()');

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(function (error) {
          expect(error).to.be.a('string');
          expect(error).to.equal('missing required arguments for sendRequest()');
        });
    });

    it('should fail when given an incorrect or outdated accessToken', function () {

      var args = vendSdk.args.products.fetch();
      args.page.value = 1;
      args.pageSize.value = 5;

      var connectionInfo = {
        domainPrefix: nconf.get('domain_prefix'),
        accessToken: nconf.get('access_token') || 'junk'
      };

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(function (error) {
          expect(error).to.be.a('string');
          expect(error).to.equal('missing required arguments for retryWhenAuthNFails()');
        });
    });

  });

  describe('when a refreshToken is available', function () {

    this.timeout(300000);

    // Why do this? It is useful if someone runs:
    //   NODE_ENV=test ./node_modules/.bin/mocha --grep <pattern>
    // on the command line to run tests and suites with names matching the pattern.
    before('requires proper configuration to run tests', function () {
      // loading twice into the `nconf` singleton is effectively a no-op, so no worries
      nconf.file('config', {file: 'config/' + process.env.NODE_ENV + '.json'});
      nconf.file('oauth', {file: 'config/oauth.json'});
    });

    it('but invalid - API calls should fail', function () {

      var args = vendSdk.args.products.fetch();
      args.page.value = 1;
      args.pageSize.value = 1;

      var doNotUseCache = true;
      var connectionInfo = getConnectionInfo(doNotUseCache);
      connectionInfo.accessToken = 'JUNK'; // done on purpose for this test case
      connectionInfo.refreshToken = 'JUNK'; // done on purpose for this test case

      return expect(vendSdk.products.fetch(args, connectionInfo)).to.be.rejectedWith(TypeError);

    });

    it('and valid - can regenerate an accessToken for use in API calls', function () {

      var args = vendSdk.args.products.fetch();
      args.page.value = 1;
      args.pageSize.value = 1;

      var doNotUseCache = true;
      var connectionInfo = getConnectionInfo(doNotUseCache);
      connectionInfo.accessToken = 'JUNK'; // done on purpose for this test case

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(TypeError, function (error) {
          expect(error).to.equal(
            undefined,
            'the refresh token might be invalid' +
                        ' \n\t\t look inside vend-nodejs-sdk.log file to confirm' +
                        ' \n\t\t or turn on console logging by using `NODE_ENV=testing ./node_modules/.bin/mocha`' +
                        ' \n\t\t to run the tests and confirm' +
                        ' \n\t\t'
          );
        });

    });

    var randomProduct;
    var getRandomProduct = function () {
      if (randomProduct) { // use cached value if available
        return Promise.resolve(randomProduct);
      }
      var args = vendSdk.args.products.fetch();
      args.page.value = 1;
      args.pageSize.value = 100;
      return vendSdk.products.fetch(args, getConnectionInfo())
        .then(function (response) {
          return Promise.map(
            response.data || [],
            function(eachProduct){
              //console.log('eachProduct', eachProduct.supplier_code, eachProduct.supplier, eachProduct.supplier_id);
              var inventoryArgs = vendSdk.args.products.fetchProductInventory();
              inventoryArgs.apiId.value = eachProduct.id;
              return vendSdk.products.fetchProductInventory(inventoryArgs, getConnectionInfo())
                .then(function (response) {
                  eachProduct.inventory = response.data || []; // place inventory inside product, like the good old 0.x days
                  return Promise.resolve();
                });
            },
            {concurrency: 1}
          )
            .then(function(){
              randomProduct = _.find(response.data, function (eachProduct) { // return the first product that fulfills these conditions
                return eachProduct.supplier && eachProduct.inventory[0].outlet_id;
              });
              return Promise.resolve(randomProduct);
            });
        });
    };

    describe.only('with sales API', function(){

      describe('then after preparing a sale', function () {
        var product, register, sale;
        it('by preparing a product', function () {
          return getRandomProduct()
            .then(function(result){
              expect(result).to.exist;
              product = result;
            });
        });
        it('by preparing a register', function () {
          var args = vendSdk.args.registers.fetch();
          return vendSdk.registers.fetch(args, getConnectionInfo())
            .then(function (response) {
              expect(response).to.exist;
              expect(response.registers).to.exist;
              expect(response.registers).to.be.instanceof(Array);
              expect(response.registers.length).to.be.greaterThan(0);
              register = response.registers[0];
            });
        });
        it('we can create a sale', function () {
          var saleBody = {
            'register_id': register.id,
            //'user_id': '???',
            'status': 'OPEN',
            'register_sale_products': [{
              'product_id': product.id,
              'quantity': 1,
              'price': 12,
              'tax': 1.8
              //'tax_id': '???'
            }]
          };
          return vendSdk.sales.create(saleBody, getConnectionInfo())
            .then(function (response) {
              expect(response).to.exist;
              expect(response.register_sale).to.exist;
              expect(response.register_sale.id).to.exist;
              expect(response.register_sale.source).to.exist;
              expect(response.register_sale.register_id).to.exist;
              expect(response.register_sale.register_id).to.equal(register.id);
              expect(response.register_sale.user_id).to.exist;
              expect(response.register_sale.total_price).to.exist;
              expect(response.register_sale.total_price).to.equal(12);
              expect(response.register_sale.total_tax).to.exist;
              expect(response.register_sale.total_tax).to.equal(1.8);
              // NOTE: in the response for creating the sale, products are in register_sale; but when fetching sales they are in line_items
              expect(response.register_sale.register_sale_products).to.exist;
              expect(response.register_sale.register_sale_products).to.be.instanceof(Array);
              expect(response.register_sale.register_sale_products.length).to.be.greaterThan(0);
              sale = response.register_sale;
            });
        });
        it('can fetch a sale by ID', function () {
          var args = vendSdk.args.sales.fetchById();
          args.apiId.value = sale.id;
          return vendSdk.sales.fetchById(args, getConnectionInfo())
            .then(function (response) {
              expect(response.data).to.exist;
              expect(response.data.id).to.exist;
              expect(response.data.source).to.exist;
              expect(response.data.register_id).to.exist;
              expect(response.data.register_id).to.equal(register.id);
              expect(response.data.user_id).to.exist;
              expect(response.data.total_price).to.exist;
              expect(response.data.total_price).to.equal(12);
              expect(response.data.total_tax).to.exist;
              expect(response.data.total_tax).to.equal(1.8);
              // NOTE: in the response for creating the sale, products are in register_sale; but when fetching sales they are in line_items
              expect(response.data.line_items).to.exist;
              expect(response.data.line_items).to.be.instanceof(Array);
              expect(response.data.line_items.length).to.be.greaterThan(0);
            });
        });
      });

    });

  });

});
