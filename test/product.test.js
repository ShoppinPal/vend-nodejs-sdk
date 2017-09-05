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
var faker = require('faker');

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

var omitEmptyValues = function omitEmptyValues(data) {
  if(!_.isObject(data)) {
    return data;
  }
  else {
    if (_.isArray(data)) {
      var clone = [];
      _.each(data, function(value) {
        if (_.isObject(value)) {
          clone.push(omitEmptyValues(value));
        }
        else if (_.isString(value) && value.trim() !== '') {
          clone.push(value);
        }
        else if (!_.isString(value)) {
          clone.push(value);
        }
      });
      return clone;
    }
    else if (_.isObject(data)) {
      var clone = {};
      _.each(data, function(value, key) {
        if (_.isObject(value)) {
          clone[key] = omitEmptyValues(value);
        }
        else if (_.isString(value) && value.trim() !== '') {
          clone[key] = value;
        }
        else if (!_.isString(value)) {
          clone[key] = value;
        }
      });
      return clone;
    }
    else {
      return data;
    }
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

    describe('with products API', function() {
      this.timeout(300000);

      var generateNewProductBody = function generateNewProduct() {
        var newProduct = {
          'name': faker.commerce.productName(), // REQUIRED
          'sku': faker.fake('{{random.number}}'), // REQUIRED
          'handle': faker.lorem.word(1), // REQUIRED
          'retail_price': faker.commerce.price(10.01, 100.00, 2), // REQUIRED
          'description': faker.lorem.sentence()
        };
        newProduct.supply_price = newProduct.retail_price - 10.00; // eslint-disable-line camelcase
        return newProduct;
      };

      it.only('can create a product', function () {
        var args = vendSdk.args.products.create();
        args.body.value = generateNewProductBody();

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                expect(response2).to.exist;
                expect(response2.products).to.exist;
                expect(response2.products).to.be.instanceof(Array);
                //expect(response2.products.length).to.equal(1);
                expect(response2.products[0].id).to.equal(response1.product.id); // IDs should match
              });
          });
      });

      /**
       * Conclusion: there is no difference
       */
      it('can create a product w/ tax_id explicitly set to null', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax_id = null; // eslint-disable-line camelcase
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                expect(response2).to.exist;
                expect(response2.products).to.exist;
                expect(response2.products).to.be.instanceof(Array);
                //expect(response2.products.length).to.equal(1);
                expect(response2.products[0].id).to.equal(response1.product.id); // IDs should match
              });
          });
      });

      /**
       * Conclusion: there is no difference
       */
      it('can create a product w/ tax explicitly set to null', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax = null;
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                expect(response2).to.exist;
                expect(response2.products).to.exist;
                expect(response2.products).to.be.instanceof(Array);
                //expect(response2.products.length).to.equal(1);
                expect(response2.products[0].id).to.equal(response1.product.id); // IDs should match
              });
          });
      });

      /**
       * TODO: use it as a negative test
       */
      it('can create a product w/ tax explicitly set to 6.66', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax = 6.66;
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                /*
                  error: A ClientError happened: 
                  400 {
                    "status": "error",
                    "error": "Could not Add or Update",
                    "details": "No tax record found for tax_name 6.66 and retailer_id 8d3e1c5a-4df1-11e2-b1f5-4040782fde00"
                  }
                 */
              });
          });
      });

      /**
       * TODO: it should fail but it doesn't, maybe because of some code glitch which treats 0.00 as false or undefined?
       * document it as a glitch
       */
      it('can create a product w/ tax explicitly set to 0.00', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax = 0.00;
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                /*
                  "tax": 5.82,
                  "tax_id": "0adfd74a-15a7-11e7-fa42-91b2fb4d898b",
                  "tax_rate": 0.06,
                  "tax_name": "Normal Sales Tax",
                 */
              });
          });
      });

      /**
       * Proves that `tax` in CREATE body is used as if it was the tax name, for matching and finding taxes
       */
      it('can create a product w/ tax explicitly set to "No Tax"', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax = 'No Tax';
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                /*
                  "tax": 0,
                  "tax_id": "1ed7990c-4527-11e3-a29a-bc305bf5da20",
                  "tax_rate": 0,
                  "tax_name": "No Tax",
                 */
              });
          });
      });

      /**
       * Conclusion: there is no difference
       */
      it.only('can create a product w/ tax and tax_id explicitly set to null', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = generateNewProductBody();
        randomProduct.tax = null;
        randomProduct.tax_id = null; // eslint-disable-line camelcase
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response1) {
            //console.log('response1.product:', JSON.stringify(response1.product,null,2));
            //console.log('response1.product:', JSON.stringify(omitEmptyValues(response1.product),null,2));

            var args = vendSdk.args.products.fetchById();
            args.apiId.value = response1.product.id;
            return vendSdk.products.fetchById(args, getConnectionInfo())
              .then(function (response2) {
                //console.log('response2.products[0]:', JSON.stringify(response2.products[0],null,2));
                console.log('response2.products[0]:', JSON.stringify(omitEmptyValues(response2.products[0]),null,2));
                /*
                  "tax": 5.94,
                  "tax_id": "0adfd74a-15a7-11e7-fa42-91b2fb4d898b",
                  "tax_rate": 0.06,
                  "tax_name": "Normal Sales Tax",
                 */
              });
          });
      });
    });

  });

});
