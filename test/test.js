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
var Promise = require('bluebird');

// Used to output logs from this test and avoids interfering with console logs
var winston = require('winston');
var log = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({filename: 'test.log', level: 'debug'})
  ]
});

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

describe('vend-nodejs-sdk', function () {/*jshint expr: true*/

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

    this.timeout(30000);

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
              return eachProduct.supplier && eachProduct.inventory[0].outlet_id;// jshint ignore:line
            });
            return Promise.resolve(randomProduct);
          });
        });
    };

    describe('test consignment product APIs', function() {
      this.timeout(300000); // attaching inventory to 100 random products for v2.0 takes a lot of time
      describe('usecase one', function() {
        var randomProduct, supplier, consignmentProductId, consignmentId;
        it('by preparing a product with a supplier and an outlet', function () {
          return getRandomProduct()
            .then(function(result){
              randomProduct = result;
              expect(randomProduct).to.exist;
              //console.log('randomProduct', randomProduct);
              supplier = randomProduct.supplier;
              expect(supplier).to.exist;
              expect(supplier.id).to.equal(randomProduct['supplier_id']);// jshint ignore:line
            });
        });
        it('by preparing a new consignment', function () {
          var consignmentArgs = vendSdk.args.consignments.stockOrders.create();
          consignmentArgs.name.value = faker.lorem.word(10);
          consignmentArgs.outletId.value = randomProduct.inventory[0].outlet_id;// jshint ignore:line
          consignmentArgs.supplierId.value = supplier.id;
          return vendSdk.consignments.stockOrders.create(consignmentArgs, getConnectionInfo())
            .tap(function (consignmentResponse) {
              // validate the response after a consignment was created
              expect(consignmentResponse).to.exist;
              expect(consignmentResponse.id).to.exist;
              expect(consignmentResponse.type).to.exist;
              expect(consignmentResponse.type).to.be.a('string');
              expect(consignmentResponse.type).to.equal('SUPPLIER');
              expect(consignmentResponse.status).to.exist;
              expect(consignmentResponse.status).to.be.a('string');
              expect(consignmentResponse.status).to.equal('OPEN');
              consignmentId = consignmentResponse.id;

              // double check if the consignment really exists or not, try to fetch it explicitly
              var args = vendSdk.args.consignments.fetchById();
              args.apiId.value = consignmentId;
              return vendSdk.consignments.fetchById(args, getConnectionInfo());
            })
            .tap(function (consignmentResponse) {
              //log.debug('consignmentResponse', consignmentResponse);

              // validate if the consignment really exists or not based on the attempt fetch it explicitly
              expect(consignmentResponse).to.exist;
              expect(consignmentResponse.id).to.exist;
              expect(consignmentResponse.type).to.exist;
              expect(consignmentResponse.type).to.be.a('string');
              expect(consignmentResponse.type).to.equal('SUPPLIER');
              expect(consignmentResponse.status).to.exist;
              expect(consignmentResponse.status).to.be.a('string');
              expect(consignmentResponse.status).to.equal('OPEN');
            });
        });
        it('by creating a consignment product', function () {
          var args = vendSdk.args.consignments.products.create();
          args.consignmentId.value = consignmentId;
          args.productId.value = randomProduct.id;
          args.cost.value = faker.random.number(4);
          args.count.value = faker.random.number();
          args.received.value = faker.random.boolean();
          args.sequenceNumber.value = faker.random.number();
          return vendSdk.consignments.products.create(args, getConnectionInfo())
            .then(function (consignmentProductResponse) {
              //log.debug('consignmentProductResponse', consignmentProductResponse);

              expect(consignmentProductResponse).to.exist;
              expect(consignmentProductResponse.id).to.exist;

              /**
               * This assertion would fail if the consignment product wasn't created
               * because of a bad product+supplier+outlet combination. In which case,
               * the vend api decides to send back the consignment (instead of the consignment PRODUCT)
               * to indicate that the work was not performed!
               */
              expect(consignmentProductResponse.id).to.not.equal(consignmentId);

              expect(consignmentProductResponse['product_id']).to.exist;// jshint ignore:line
              expect(consignmentProductResponse['product_id']).to.equal(randomProduct.id);// jshint ignore:line
              expect(consignmentProductResponse['consignment_id']).to.exist;// jshint ignore:line
              expect(consignmentProductResponse['consignment_id']).to.equal(consignmentId);// jshint ignore:line

              consignmentProductId = consignmentProductResponse.id;
            });
        });
        it('by fetching a consignment product by ID', function () {
          // double check if the consignmentProduct really exists or not, try to fetch it explicitly
          var args = vendSdk.args.consignments.products.fetchById();
          args.apiId.value = consignmentProductId;
          return vendSdk.consignments.products.fetchById(args, getConnectionInfo())
            .then(function (fetchConsignmentByProductIdResponse) {
              // validate if the consignmentProduct really exists or not based on the attempt fetch it explicitly
              expect(fetchConsignmentByProductIdResponse).to.exist;
              expect(fetchConsignmentByProductIdResponse.id).to.exist;
              expect(fetchConsignmentByProductIdResponse.id).to.not.equal(consignmentId);
              expect(fetchConsignmentByProductIdResponse['product_id']).to.exist;// jshint ignore:line
              expect(fetchConsignmentByProductIdResponse['product_id']).to.equal(randomProduct.id);// jshint ignore:line
              expect(fetchConsignmentByProductIdResponse['consignment_id']).to.exist;// jshint ignore:line
              expect(fetchConsignmentByProductIdResponse['consignment_id']).to.equal(consignmentId);// jshint ignore:line

              // validate if what was created, is what we fetched now
              expect(fetchConsignmentByProductIdResponse.id).to.equal(consignmentProductId);
            });
        });
        it('by deleting a consignment', function () {
          var deleteConsignmentArgs = vendSdk.args.consignments.stockOrders.remove();
          deleteConsignmentArgs.apiId.value = consignmentId;
          return vendSdk.consignments.stockOrders.remove(deleteConsignmentArgs, getConnectionInfo())
            .then(function (deletedConsignmentResponse) {
              //log.debug('deletedConsignmentResponse', deletedConsignmentResponse);
              expect(deletedConsignmentResponse).to.exist;
              expect(deletedConsignmentResponse.status).to.exist;
              expect(deletedConsignmentResponse.status).to.be.a('string');
              expect(deletedConsignmentResponse.status).to.equal('success');
            });
        });
        it('by confirming that deleting a consignment also deletes its consignmentProducts', function () {
          var args = vendSdk.args.consignments.products.fetchById();
          args.apiId.value = consignmentProductId;
          return vendSdk.consignments.products.fetchById(args, getConnectionInfo())
            .catch(function (error) {
              //log.debug('error', error);
              expect(error).to.exist;
              expect(error).to.be.a('string');
              expect(error).to.be.a('string').that.includes('No such entity');
            });
        });
      });
      describe('usecase two', function() {
        var randomProduct, supplier, consignmentProductId, consignmentId;
        it('by preparing a product with a supplier and an outlet', function () {
          return getRandomProduct()
            .then(function(result){
              randomProduct = result;
              expect(randomProduct).to.exist;
              supplier = randomProduct.supplier;
              expect(supplier).to.exist;
              expect(supplier.id).to.equal(randomProduct['supplier_id']);// jshint ignore:line
            });
        });
        it('by preparing a new consignment', function () {
          var consignmentArgs = vendSdk.args.consignments.stockOrders.create();
          consignmentArgs.name.value = faker.lorem.word(10);
          consignmentArgs.outletId.value = randomProduct.inventory[0].outlet_id;// jshint ignore:line
          consignmentArgs.supplierId.value = supplier.id;
          return vendSdk.consignments.stockOrders.create(consignmentArgs, getConnectionInfo())
            .tap(function (consignmentResponse) {
              // validate the response after a consignment was created
              expect(consignmentResponse).to.exist;
              expect(consignmentResponse.id).to.exist;
              expect(consignmentResponse.type).to.exist;
              expect(consignmentResponse.type).to.be.a('string');
              expect(consignmentResponse.type).to.equal('SUPPLIER');
              expect(consignmentResponse.status).to.exist;
              expect(consignmentResponse.status).to.be.a('string');
              expect(consignmentResponse.status).to.equal('OPEN');
              consignmentId = consignmentResponse.id;

              // double check if the consignment really exists or not, try to fetch it explicitly
              var args = vendSdk.args.consignments.fetchById();
              args.apiId.value = consignmentId;
              return vendSdk.consignments.fetchById(args, getConnectionInfo());
            })
            .tap(function (consignmentResponse) {
              //log.debug('consignmentResponse', consignmentResponse);

              // validate if the consignment really exists or not based on the attempt fetch it explicitly
              expect(consignmentResponse).to.exist;
              expect(consignmentResponse.id).to.exist;
              expect(consignmentResponse.type).to.exist;
              expect(consignmentResponse.type).to.be.a('string');
              expect(consignmentResponse.type).to.equal('SUPPLIER');
              expect(consignmentResponse.status).to.exist;
              expect(consignmentResponse.status).to.be.a('string');
              expect(consignmentResponse.status).to.equal('OPEN');
            });
        });
        it('by creating a consignment product', function () {
          var args = vendSdk.args.consignments.products.create();
          args.consignmentId.value = consignmentId;
          args.productId.value = randomProduct.id;
          args.cost.value = faker.random.number(4);
          args.count.value = faker.random.number();
          args.received.value = faker.random.boolean();
          args.sequenceNumber.value = faker.random.number();
          return vendSdk.consignments.products.create(args, getConnectionInfo())
            .then(function (consignmentProductResponse) {
              //log.debug('consignmentProductResponse', consignmentProductResponse);

              expect(consignmentProductResponse).to.exist;
              expect(consignmentProductResponse.id).to.exist;

              /**
                   * This assertion would fail if the consignment product wasn't created
                   * because of a bad product+supplier+outlet combination. In which case,
                   * the vend api decides to send back the consignment (instead of the consignment PRODUCT)
                   * to indicate that the work was not performed!
                   */
              expect(consignmentProductResponse.id).to.not.equal(consignmentId);

              expect(consignmentProductResponse['product_id']).to.exist;// jshint ignore:line
              expect(consignmentProductResponse['product_id']).to.equal(randomProduct.id);// jshint ignore:line
              expect(consignmentProductResponse['consignment_id']).to.exist;// jshint ignore:line
              expect(consignmentProductResponse['consignment_id']).to.equal(consignmentId);// jshint ignore:line

              consignmentProductId = consignmentProductResponse.id;
            });
        });
        it('by deleting the consignmentProduct by ID', function () {
          var args = vendSdk.args.consignments.products.remove();
          args.apiId.value = consignmentProductId;
          return vendSdk.consignments.products.remove(args, getConnectionInfo())
            .then(function (deletedConsignmentProductResponse) {
              //log.debug('deletedConsignmentProductResponse', deletedConsignmentProductResponse);
              expect(deletedConsignmentProductResponse).to.exist;
              expect(deletedConsignmentProductResponse.status).to.exist;
              expect(deletedConsignmentProductResponse.status).to.be.a('string');
              expect(deletedConsignmentProductResponse.status).to.equal('success');
            });
        });
        it('by confirming that the deleted consignmentProduct, no longer exists', function () {
          var args = vendSdk.args.consignments.products.fetchById();
          args.apiId.value = consignmentProductId;
          return vendSdk.consignments.products.fetchById(args, getConnectionInfo())
            .catch(function (error) {
              //log.debug('error', error);
              expect(error).to.exist;
              expect(error).to.be.a('string');
              expect(error).to.be.a('string').that.includes('Entity has been deleted');
            });
        });
      });
    });

    describe('with products API', function() {
      this.timeout(300000);

      var productsForTesting;
      it('can fetch products', function () {
        var args = vendSdk.args.products.fetch();
        args.page.value = 1;
        args.pageSize.value = 5;
        return vendSdk.products.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.data).to.exist;
            expect(response.data).to.be.instanceof(Array);
            expect(response.data).to.have.length.of.at.least(1);
            expect(response.data).to.have.length.of.at.most(5);
            productsForTesting = response.data;
            if (response.version) {/*jshint camelcase: false */
              expect(response.version.min).to.exist;
              expect(response.version.max).to.exist;
            }
          })
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

      /**
       * `productsForTesting` must be initialized by the previous testcase for this test to work
       */
      it('can fetch a product by ID', function () {
        // fetch a product by ID
        var args = vendSdk.args.products.fetchById();
        args.apiId.value = _.last(productsForTesting).id;
        return vendSdk.products.fetchById(args, getConnectionInfo())
          .then(function (response2) {
            expect(response2).to.exist;
            expect(response2.products).to.exist;
            expect(response2.products).to.be.instanceof(Array);
            expect(response2.products.length).to.equal(1);
            expect(response2.products[0].id).to.equal(_.last(productsForTesting).id); // IDs should match
          });
      });

      it('can paginate when fetching products', function () {
        var args = vendSdk.args.products.fetch();
        args.page.value = 1;
        args.pageSize.value = 1;
        return vendSdk.products.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.data).to.exist;
            expect(response.data).to.be.instanceof(Array);
            expect(response.data.length).to.equal(1);
          });
      });

      var productsAcquiredWithDefaultPageSize;
      it('can fetch ALL products w/ default page size', function() { // NOTE: default page size is 1000 based on passive observation
        var args = vendSdk.args.products.fetchAll();
        return vendSdk.products.fetchAll(args, getConnectionInfo()) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allProducts) {
            expect(allProducts).to.exist;
            expect(allProducts).to.be.instanceof(Array);
            productsAcquiredWithDefaultPageSize = allProducts.length;
          });
      });

      var productsAcquiredWithCustomPageSize;
      it('can fetch ALL products w/ custom page size', function() {
        var args = vendSdk.args.products.fetchAll();
        args.pageSize.value = 40000;
        return vendSdk.products.fetchAll(args, getConnectionInfo()) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allProducts) {
            expect(allProducts).to.exist;
            expect(allProducts).to.be.instanceof(Array);
            productsAcquiredWithCustomPageSize = allProducts.length;
            expect(productsAcquiredWithCustomPageSize).to.be.equal(productsAcquiredWithDefaultPageSize);
          });
      });

      var productsAcquiredWithCustomProcessor;
      it('can fetch ALL products w/ custom processor', function() {
        var customProcessor = function processPagedResults(pagedData, previousData) {
          if(previousData && previousData.length>0) {
            if(pagedData.data && pagedData.data.length>0) {
              pagedData.data = pagedData.data.concat(previousData);
            }
            else {
              pagedData.data = previousData;
            }
          }
          return Promise.resolve(pagedData.data);
        };
        var args = vendSdk.args.products.fetchAll();
        args.pageSize.value = 40000;
        return vendSdk.products.fetchAll(args, getConnectionInfo(), customProcessor) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allProducts) {
            expect(allProducts).to.exist;
            expect(allProducts).to.be.instanceof(Array);
            productsAcquiredWithCustomProcessor = allProducts.length;
            expect(productsAcquiredWithCustomProcessor).to.be.equal(productsAcquiredWithDefaultPageSize);
          });
      });

      it('can fetch ALL active and inactive products', function() {
        var args = vendSdk.args.products.fetchAll();
        args.pageSize.value = 40000;
        args.deleted.value = true;
        return vendSdk.products.fetchAll(args, getConnectionInfo())
          .then(function (allProducts) {
            expect(allProducts).to.exist;
            expect(allProducts).to.be.instanceof(Array);
            expect(allProducts.length).to.be.greaterThan(productsAcquiredWithDefaultPageSize);
          });
      });
    });

    describe('with customers API', function(){
      var customer = {
        'first_name': 'boy',
        'last_name': 'blue',
        'email': 'boy' + Date.now() + '@blue.com'
      };
      it('can create a customer', function () {
        return vendSdk.customers.create(customer, getConnectionInfo())
          .then(function(response){
            log.debug('response', response);
          });
      });

      it('can fetch a customer by email', function () {
        // this is just a convenience method
        return vendSdk.customers.fetchByEmail(customer.email, getConnectionInfo())
          .then(function(response){
            log.debug('response', response);
            expect(response).to.exist;
            expect(response).to.be.instanceof(Object);
            expect(response.customers).to.exist;
            expect(response.customers).to.be.instanceof(Array);
            expect(response.customers.length).to.be.equal(1);
            expect(response.customers[0].first_name).to.be.equal(customer.first_name); // jshint ignore:line
            expect(response.customers[0].last_name).to.be.equal(customer.last_name); // jshint ignore:line
            expect(response.customers[0].email).to.be.equal(customer.email);
          });
      });

      it('can fetch ALL customers', function () {
        var args = vendSdk.args.customers.fetchAll();
        return vendSdk.customers.fetchAll(args, getConnectionInfo())
          .then(function(customers){
            expect(customers).to.exist;
            expect(customers).to.be.instanceof(Array);
            expect(customers.length).to.be.greaterThan(0);
            log.debug('can fetch ALL customers', 'customers.length:', customers.length);
          });
      });
    });

    xit('BROKEN: can create a product', function () {
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
        .then(function (response) {
          log.debug('response', response);
        });
    });

    xit('TODO: can fetch a product that was just created', function () {
      // TODO: implement it
    });

    xit('UNVERIFIED: can upload product image', function () {
      // TODO: implement it
    });

    it('can fetch registers', function () {
      var args = vendSdk.args.registers.fetch();
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can fetch registers', 'response:', response);
          expect(response).to.exist;
          expect(response.registers).to.exist;
          expect(response.registers).to.be.instanceof(Array);
        });
    });

    it('cannot paginate when fetching registers - it is not supported by vend in 0.x', function () {
      var args = vendSdk.args.registers.fetch();
      args.page.value = 1;
      args.pageSize.value = 1;
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function (response) {
          //console.log(response);
          expect(response).to.exist;
          expect(response.registers).to.exist;
          expect(response.registers).to.be.instanceof(Array);
          expect(response.registers).to.have.length.above(1); // TODO: what if no more than 1 registers exist?
        });
    });

    it('can fetch a register by ID', function () {
      var args = vendSdk.args.registers.fetch();
      return vendSdk.registers.fetch(args, getConnectionInfo())
        .then(function (response1) {
          expect(response1).to.exist;
          expect(response1.registers).to.exist;
          expect(response1.registers).to.be.instanceof(Array);
          expect(response1.registers).to.have.length.of.at.least(1); // TODO: what if no registers exist at all?

          // fetch a register by ID
          var args = vendSdk.args.registers.fetchById();
          args.apiId.value = _.last(response1.registers).id;
          return vendSdk.registers.fetchById(args, getConnectionInfo())
            .then(function (response2) {
              expect(response2).to.exist;
              expect(response2.data).to.exist;
              expect(response2.data).to.be.instanceof(Object);
              expect(response2.data.id).to.equal(_.last(response1.registers).id); // IDs should match
            });
        });
    });

    xit('SKIP: can fetch ALL registers', function () {
      log.info('This test is pointless because pagination is not supported for registes by Vend.' +
                '\nSo while we can fetch a max of 200 registers, there is no way we can page' +
                '\nthrough and fetch more than that if they existed.\n');
    });

    it('UNVERIFIED: can create a tag', function () {
      // TODO: implement it - create some tags so fetch can be more relevant/concrete
    });

    it('can fetch tags', function () {
      var args = vendSdk.args.tags.fetch();
      return vendSdk.tags.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can fetch tags', 'response:', response);
          expect(response).to.exist;
          expect(response.data).to.exist;
          expect(response.data).to.be.instanceof(Array);
          //log.debug('can fetch tags', 'response.data.length:', response.data.length);
        });
    });

    it('can paginate when fetching tags', function () {
      var args = vendSdk.args.tags.fetch();
      args.pageSize.value = 2;
      return vendSdk.tags.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can paginate when fetching tags', 'response:', response);
          expect(response).to.exist;
          expect(response.data).to.exist;
          expect(response.data).to.be.instanceof(Array);
          expect(response.data.length).to.equal(2);
          //log.debug('can paginate when fetching tags', 'response.data.length:', response.data.length);
        });
    });

    xit('can fetch ALL tags', function () {
      var args = vendSdk.args.tags.fetch();
      args.pageSize.value = 2;
      return vendSdk.tags.fetchAll(args, getConnectionInfo())
        .then(function (allTags) {
          //log.debug('can fetch ALL tags', 'allTags:', allTags);
          expect(allTags).to.exist;
          expect(allTags).to.be.instanceof(Array);
          //log.debug('can fetch ALL tags', 'allTags.length:', allTags.length);
        });
    });

    xit('DUPLICATE: can paginate when fetching tags and start AFTER a given point in time', function () {
      log.debug('The previous test already executes code which does this internally' +
                ' by starting AFTER version 0 by default.' +
                '\n While it would be nice to give a different version to start "AFTER" than 0,' +
                ' a valid/meaningful version to use in tests will be different in every Vend subdomain');
    });

    xit('FEATURE REQUEST: can fetch ALL tags AFTER a given point in time', function () {
      // TODO: implement it
    });

    it('can fetch outlets', function () {
      var args = vendSdk.args.outlets.fetch();
      return vendSdk.outlets.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can fetch outlets', 'response:', response);
          expect(response).to.exist;
          expect(response.outlets).to.exist;
          expect(response.outlets).to.be.instanceof(Array);
          expect(response.outlets).to.have.length.of.at.least(1);
          //log.debug('can fetch outlets', 'response.outlets.length:', response.outlets.length);
        });
    });

    it('can fetch an outlet by ID', function () {
      var args = vendSdk.args.outlets.fetch();
      return vendSdk.outlets.fetch(args, getConnectionInfo())
        .then(function (response1) {
          //log.debug('can fetch an outlet by ID', 'response1:', response1);
          expect(response1).to.exist;
          expect(response1.outlets).to.exist;
          expect(response1.outlets).to.be.instanceof(Array);
          expect(response1.outlets).to.have.length.of.at.least(1);
          //log.debug('can fetch an outlet by ID', 'response1.outlets.length:', response1.outlets.length);

          // fetch a product by ID
          var args = vendSdk.args.outlets.fetchById();
          args.apiId.value = _.last(response1.outlets).id;
          return vendSdk.outlets.fetchById(args, getConnectionInfo())
            .then(function (response2) {
              //log.debug('can fetch an outlet by ID', 'response2:', response2);
              expect(response2).to.exist;
              expect(response2.data).to.exist;
              expect(response2.data).to.be.instanceof(Object);
              expect(response2.data.id).to.equal(_.last(response1.outlets).id); // IDs should match
            });
        });
    });

    it('can fetch ALL outlets', function () {
      // NOTE: no need for fetchAll since hardly any Vend customers have more than 200 outlets
      var args = vendSdk.args.outlets.fetch();
      args.pageSize.value = 2;
      return vendSdk.outlets.fetchAll(args, getConnectionInfo())
        .then(function (outlets) {
          //log.debug('can fetch ALL outlets', 'outlets:', outlets);
          expect(outlets).to.exist;
          expect(outlets).to.be.instanceof(Array);
          //log.debug('can fetch ALL outlets', 'outlets.length:', outlets.length);
        });
    });

    xit('FEATURE REQUEST: can fetch ALL outlets AFTER a given point in time', function () {
      // TODO: implement it
    });

    xit('UNVERIFIED: can create a product-type', function () {
      var args = vendSdk.args.productTypes.create();
      args.body.value = {
        name: faker.commerce.department()
      };
      return vendSdk.productTypes.create(args, getConnectionInfo());
    });

    it('can fetch product-types', function () {
      var args = vendSdk.args.productTypes.fetch();
      return vendSdk.productTypes.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can fetch product-types', 'response:', response);
          expect(response).to.exist;
          expect(response.data).to.exist;
          expect(response.data).to.be.instanceof(Array);
          expect(response.data).to.have.length.of.at.least(1);
          //log.debug('can fetch product-types', 'response.data.length:', response.data.length);
        });
    });

    it('UNVERIFIED: can create a brand', function () {
      // TODO: implement it
    });

    it('can fetch brands', function () {
      var args = vendSdk.args.brands.fetch();
      return vendSdk.brands.fetch(args, getConnectionInfo())
        .then(function (response) {
          //log.debug('can fetch brands', 'response:', response);
          expect(response).to.exist;
          expect(response.data).to.exist;
          expect(response.data).to.be.instanceof(Array);
          expect(response.data).to.have.length.of.at.least(1);
          //log.debug('can fetch brands', 'response.data.length:', response.data.length);
        });
    });

    it('UNVERIFIED: can create a supplier', function () {
      // TODO: implement it
    });

    it('UNVERIFIED: can create a tax', function () {
      // TODO: implement it
    });

    describe('this will create a sale with all the relevant data', function () {

      var customerData, taxData, registers, paymentType;

      var registerSale = {
        register_id: null, // jshint ignore:line
        customer_id: null, // jshint ignore:line
        register_sale_products: [], // jshint ignore:line
        register_sale_payments: [], // jshint ignore:line
        note: 'This sale is created by a test',
        status: 'CLOSED',
        sale_date: new Date().toString(), // jshint ignore:line
        short_code: faker.random.word() // jshint ignore:line
      };

      var createPaymentTypesArray = function (paymentTypesArray) {
        paymentType = _.sample(paymentTypesArray, 1);
        return paymentType[0];
      };

      var createTaxData = function () {
        var args = vendSdk.args.taxes.create();
        args.body.value = {
          name: 'Normal Sales Tax',
          rate: 0.06
        };
        return vendSdk.taxes.create(args, getConnectionInfo())
          .then(function (response) {
            taxData = response;
            return taxData;
          });
      };

      var createRegisterSaleProducts = function (product) {
        var data = {
          register_id: registers.id, // jshint ignore:line
          product_id: product.id, // jshint ignore:line
          quantity: 1,
          price: product.supply_price, // jshint ignore:line
          tax: taxData.rate,
          tax_id: taxData.id // jshint ignore:line
        };
        return registerSale.register_sale_products.push(data); // jshint ignore:line
      };

      var createRegisterSalePayments = function (payment) {
        log.debug('The payment that will be attached to the sale', payment);
        return registerSale.register_sale_payments.push({ // jshint ignore:line
          retailer_payment_type_id: payment.id, // jshint ignore:line
          register_id: registers.id, // jshint ignore:line
          payment_date: new Date().toString(), // jshint ignore:line
          amount: 192
        });
      };

      var addMoreRegisterSaleProducts = function (productsArray) {
        return _.each(productsArray, function (product) {
          var data = {
            register_id: registers.id, // jshint ignore:line
            product_id: product.id, // jshint ignore:line
            quantity: 1,
            price: product.supply_price, // jshint ignore:line
            tax: product.tax,
            tax_id: product.tax_id // jshint ignore:line
          };
          if (registerSale.register_sale_products.indexOf(data) === -1) { // jshint ignore:line
            return registerSale.register_sale_products.push(data) // jshint ignore:line
          }
        });
      };

      it('can create a customer that will be further get attached to a sale', function () {
        var customer = {
          'first_name': faker.name.firstName(),
          'last_name': faker.name.lastName(),
          'email': faker.lorem.word() + '@tinker.com'
        };
        return vendSdk.customers.create(customer, getConnectionInfo())
          .then(function (customerResponse) {
            customerData = customerResponse.customer;
          });
      });

      it('can fetch registers to which a sale will be created', function () {
        var args = vendSdk.args.registers.fetch();
        return vendSdk.registers.fetch(args, getConnectionInfo())
          .then(function (response) {
            log.debug(response);
            return _.sample(response.registers, 1);
          })
          .then(function (registersArray) {
            registers = registersArray[0];
            log.debug('The register object', registers);
          });
      });

      it('will either fetch Normal Sales Tax and add it to the sale or it will create a Normal Sales Tax and then add it to the sale', function () {
        var args = vendSdk.args.taxes.fetch();
        return vendSdk.taxes.fetch(args, getConnectionInfo())
          .then(function (response) {
            return Promise.resolve(
              _.find(response.taxes, function (tax) {
                return tax.name === 'Normal Sales Tax' && tax.active === true;
              })
            );
          })
          .then(function (tax) {
            if(tax === undefined){
              return createTaxData();
            }
            else{
              taxData = tax;
            }
          });
      });

      it('can create a product for the sale', function () {
        var args = vendSdk.args.products.create();

        var randomProduct = {
          'handle': faker.lorem.word(1),
          'has_variants': false, // jshint ignore:line
          //'active':true,
          'name': faker.commerce.productName(),
          'retail_price': faker.fake('{{random.number}}'), // jshint ignore:line
          'description': faker.lorem.sentence(),
          'tax_id': null, // jshint ignore:line
          'tax': null,
          'sku': faker.fake('{{random.number}}'), // faker.random.number,
          'supply_price': faker.fake('{{commerce.price}}') // faker.commerce.price // jshint ignore:line
        };
        randomProduct.price = String(Number(randomProduct['supply_price']) + 10.00); // jshint ignore:line
        args.body.value = randomProduct;

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response) {
            log.debug('Product Response', response);
            return response.product;
          })
          .then(function (product) {
            Promise.resolve(createRegisterSaleProducts(product));
          });
      });

      it('can fetch products and add them to the register sale products array', function () {
        var args = vendSdk.args.products.fetch();
        args.page.value = 1;
        args.pageSize.value = 50;
        return vendSdk.products.fetch(args, getConnectionInfo())
          .then(function (response) {
            return _.sample(response.data, 5);
          })
          .then(function (products) {
            Promise.resolve(addMoreRegisterSaleProducts(products));
          });
      });

      it('can fetch all payment types', function () {
        var args = vendSdk.args.paymentTypes.fetch();
        return vendSdk.paymentTypes.fetch(args, getConnectionInfo())
          .then(function (response) {
            log.debug(response);
            return response.payment_types; // jshint ignore:line
          })
          .then(function (paymentTypes) {
            return Promise.resolve(createPaymentTypesArray(paymentTypes));
          })
          .then(function (arrayResponse) {
            Promise.resolve(createRegisterSalePayments(arrayResponse));
          });
      });

      it('can create a register sale', function () {
        registerSale.customer_id = customerData.id; // jshint ignore:line
        registerSale.register_id = registers.id; // jshint ignore:line
        return vendSdk.sales.create(registerSale, getConnectionInfo())
          .then(function (saleResponse) {
            log.debug('SALE-RESPONSE', JSON.stringify(saleResponse, undefined, 2));
            expect(saleResponse).to.exist;
            expect(saleResponse.register_sale).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.id).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.customer_id).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.customer_id).to.equal(customerData.id); // jshint ignore:line
            expect(saleResponse.register_sale.register_id).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.register_id).to.equal(registers.id); // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_payments).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_payments).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_payments).to.be.instanceOf(Array); // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_payments.length).to.equal(1); // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_products).to.exist; // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_products).to.be.instanceOf(Array); // jshint ignore:line
            expect(saleResponse.register_sale.register_sale_products.length).to.equal(6); // jshint ignore:line
          });
      });
    });

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
        var saleBody = { // jshint ignore:line
          'register_id': register.id,
          //'user_id': '???',
          'status': 'OPEN',
          'register_sale_products': [{
              'product_id': product.id
              , 'quantity': 1
              , 'price': 12
              , 'tax': 1.8
              //'tax_id': '???'
          }]
        };
        /* jshint ignore:start */
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
          /* jshint ignore:end */
      });
      it('can fetch a sale by ID', function () {
        var args = vendSdk.args.sales.fetchById();
        args.apiId.value = sale.id;
        /* jshint ignore:start */
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
          /* jshint ignore:end */
      });
    });

  });

});
