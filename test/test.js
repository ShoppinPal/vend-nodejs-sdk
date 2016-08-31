'use strict';

var nconf = require('nconf');
//nconf.argv().env();

var chai = require('chai');
var expect = require('chai').expect;

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var vendSdk = require('./../vend')({
  debugRequests: false // flip it to true to see detailed request/response logs
});
var _ = require('underscore');
var faker = require('faker');

// Used to output logs from this test and avoids interfering with console logs
var winston = require('winston');
var log = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ filename: 'test.log', level: 'debug' })
  ]
});

var cachedConnectionInfo;
var getConnectionInfo = function(noCache) {
  if (!noCache) {
    if(!cachedConnectionInfo) {
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

describe('vend-nodejs-sdk', function() {/*jshint expr: true*/

  describe('requires proper configuration to run tests', function() {
    it('NODE_ENV must be set', function() {
      expect(process.env.NODE_ENV).to.exist;
      expect(process.env.NODE_ENV).to.be.a('string');
      expect(process.env.NODE_ENV).to.not.be.empty;
    });
    it('a file with client data must be available', function() {
      nconf.file('config', { file: 'config/' + process.env.NODE_ENV + '.json' });

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
    it('a file with oauth data must be available', function() {
      nconf.file('oauth', { file: 'config/oauth.json' });

      expect(nconf.get('domain_prefix')).to.exist;
      expect(nconf.get('domain_prefix')).to.be.a('string');
      expect(nconf.get('domain_prefix')).to.not.be.empty;

      expect(nconf.get('refresh_token')).to.exist;
      expect(nconf.get('refresh_token')).to.be.a('string');
      expect(nconf.get('refresh_token')).to.not.be.empty;
    });
  });

  describe('when refreshToken is unavailable', function() {

    it('should fail when accessToken is missing', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 5;
      args.active.value = true;

      var connectionInfo = {
        domainPrefix: nconf.get('domain_prefix')
      };

      /* short hand for testing */
      //var unresolvedPromise = vendSdk.products.fetch(args, connectionInfo);
      //return expect(unresolvedPromise).to.be.rejectedWith('missing required arguments for sendRequest()');

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(function(error){
          expect(error).to.be.a('string');
          expect(error).to.equal('missing required arguments for sendRequest()');
        });
    });

    it('should fail when given an incorrect or outdated accessToken', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 5;
      args.active.value = true;

      var connectionInfo = {
        domainPrefix: nconf.get('domain_prefix'),
        accessToken: nconf.get('access_token') || 'junk'
      };

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(function(error){
          expect(error).to.be.a('string');
          expect(error).to.equal('missing required arguments for retryWhenAuthNFails()');
        });
    });

  });

  describe('when a refreshToken is available', function() {

    this.timeout(30000);

    it('but invalid - API calls should fail', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 1;
      args.active.value = true;

      var doNotUseCache = true;
      var connectionInfo = getConnectionInfo(doNotUseCache);
      connectionInfo.accessToken = 'JUNK'; // done on purpose for this test case
      connectionInfo.refreshToken = 'JUNK'; // done on purpose for this test case

      return expect( vendSdk.products.fetch(args, connectionInfo) ).to.be.rejectedWith(TypeError);

    });

    it('and valid - can regenerate an accessToken for use in API calls', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 1;
      args.active.value = true;

      var doNotUseCache = true;
      var connectionInfo = getConnectionInfo(doNotUseCache);
      connectionInfo.accessToken = 'JUNK'; // done on purpose for this test case

      return vendSdk.products.fetch(args, connectionInfo)
        .catch(TypeError, function(error){
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

    it('can fetch products', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 5;
      args.active.value = true;

      return vendSdk.products.fetch(args, getConnectionInfo())
        .then(function(response){
          expect(response).to.exist;
          expect(response.products).to.exist;
          expect(response.products).to.be.instanceof(Array);
          expect(response.products).to.have.length.of.at.least(1);
          expect(response.products).to.have.length.of.at.most(5);
          if(response.pagination) {/*jshint camelcase: false */
            expect(response.pagination.results).to.exist;
            expect(response.pagination.results).to.be.above(0);
            expect(response.pagination.page).to.exist;
            expect(response.pagination.page).to.be.equal(1);
            expect(response.pagination.page_size).to.exist;
            expect(response.pagination.page_size).to.be.equal(args.pageSize.value);
            expect(response.pagination.pages).to.exist;
            expect(response.pagination.pages).to.be.above(0);
          }
        })
        .catch(TypeError, function(error){
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

    it('can paginate when fetching products', function() {
      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 1;
      args.active.value = true;
      return vendSdk.products.fetch(args, getConnectionInfo())
        .then(function(response){
          expect(response).to.exist;
          expect(response.products).to.exist;
          expect(response.products).to.be.instanceof(Array);
          expect(response.products.length).to.equal(1);
        });
    });

    it('can fetch a product by ID', function() {

      var args = vendSdk.args.products.fetch();
      args.orderBy.value = 'id';
      args.page.value = 1;
      args.pageSize.value = 1;
      args.active.value = true;

      // get one of any product
      return vendSdk.products.fetch(args, getConnectionInfo())
        .then(function(response1){
          expect(response1).to.exist;
          expect(response1.products).to.exist;
          expect(response1.products).to.be.instanceof(Array);
          expect(response1.products).to.have.length.of.at.least(1);

          // fetch a product by ID
          var args = vendSdk.args.products.fetchById();
          args.apiId.value = _.last(response1.products).id;
          return vendSdk.products.fetchById(args, getConnectionInfo())
            .then(function(response2){
              expect(response2).to.exist;
              expect(response2.products).to.exist;
              expect(response2.products).to.be.instanceof(Array);
              expect(response2.products.length).to.equal(1);
              expect(response2.products[0].id).to.equal(_.last(response1.products).id); // IDs should match
            });
        });
    });

    it('can create a customer', function() {
      // create a dummy customer
      var customer = {
        'first_name': 'boy',
        'last_name': 'blue',
        'email': 'boy'+Date.now()+'@blue.com'
      };
      return vendSdk.customers.create(customer, getConnectionInfo());
    });

    xit('BROKEN: can create a product', function() {
      // TODO: implement it - doesn't work right now
      var args = vendSdk.args.products.create();

      var randomProduct = {
        'handle': faker.lorem.word(1),
        'has_variants': false,
        //'active':true,
        'name': faker.commerce.productName(),
        'description': faker.lorem.sentence(),
        'sku': faker.fake('{{random.number}}'), // faker.random.number,
        'supply_price': faker.fake('{{commerce.price}}') // faker.commerce.price
      };
      randomProduct.price = String(Number(randomProduct['supply_price']) + 10.00); // jshint ignore:line
      args.body.value = randomProduct;

      return vendSdk.products.create(args, getConnectionInfo())
        .then(function(response){
          log.debug('response', response);
        });
    });

    xit('TODO: can fetch a product that was just created', function() {
      // TODO: implement it
    });

    xit('UNVERIFIED: can upload product image', function() {
      // TODO: implement it
    });

    it('can fetch registers', function() {
      var args = vendSdk.args.registers.fetch();
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function(response){
          //console.log(response);
          expect(response).to.exist;
          expect(response.registers).to.exist;
          expect(response.registers).to.be.instanceof(Array);
        });
    });

    it('cannot paginate when fetching registers - it is not supported by vend in 0.x', function() {
      var args = vendSdk.args.registers.fetch();
      args.page.value = 1;
      args.pageSize.value = 1;
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function(response){
          //console.log(response);
          expect(response).to.exist;
          expect(response.registers).to.exist;
          expect(response.registers).to.be.instanceof(Array);
          expect(response.registers).to.have.length.above(1); // TODO: what if no more than 1 registers exist?
        });
    });

    it('can fetch a register by ID', function() {
      var args = vendSdk.args.registers.fetch();
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function(response1){
          expect(response1).to.exist;
          expect(response1.registers).to.exist;
          expect(response1.registers).to.be.instanceof(Array);
          expect(response1.registers).to.have.length.of.at.least(1); // TODO: what if no registers exist at all?

          // fetch a register by ID
          var args = vendSdk.args.registers.fetchById();
          args.apiId.value = _.last(response1.registers).id;
          return vendSdk.registers.fetchById(args, getConnectionInfo())
            .then(function(response2){
              expect(response2).to.exist;
              expect(response2.data).to.exist;
              expect(response2.data).to.be.instanceof(Object);
              expect(response2.data.id).to.equal(_.last(response1.registers).id); // IDs should match
            });
        });
    });

    it('can fetch ALL registers', function() {
      // TODO: implement it
    });

    it('can fetch tags', function() {
      // TODO: implement it
    });

    it('can create a tag', function() {
      // TODO: implement it
    });

    xit('can fetch outlets', function() {
      // TODO: implement it
    });

    it('can fetch an outlet by ID', function() {
      // TODO: implement it
    });

    xit('can fetch ALL outlets', function() {
      // NOTE: no need for fetchAll since hardly any Vend customers have more than 200 outlets
    });

    it('can fetch product-types', function() {
      // TODO: implement it
    });

    it('can create a product-type', function() {
      // TODO: implement it
    });

    it('can fetch brands', function() {
      // TODO: implement it
    });

    it('can create a brand', function() {
      // TODO: implement it
    });

    it('can create a supplier', function() {
      // TODO: implement it
    });

    it('can create a tax', function() {
      // TODO: implement it
    });

  });

});
