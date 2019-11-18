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
            function (eachProduct) {
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
            .then(function () {
              randomProduct = _.find(response.data, function (eachProduct) { // return the first product that fulfills these conditions
                return eachProduct.supplier && eachProduct.inventory[0].outlet_id;
              });
              return Promise.resolve(randomProduct);
            });
        });
    };

    describe('test consignment product APIs', function () {
      this.timeout(300000); // attaching inventory to 100 random products for v2.0 takes a lot of time
      describe('usecase one', function () {
        var randomProduct, supplier, consignmentProductId, consignmentId;
        it('by preparing a product with a supplier and an outlet', function () {
          return getRandomProduct()
            .then(function (result) {
              randomProduct = result;
              expect(randomProduct).to.exist;
              //console.log('randomProduct', randomProduct);
              supplier = randomProduct.supplier;
              expect(supplier).to.exist;
              expect(supplier.id).to.equal(randomProduct['supplier_id']);
            });
        });
        it('by preparing a new consignment', function () {
          var consignmentArgs = vendSdk.args.consignments.stockOrders.create();
          consignmentArgs.name.value = faker.lorem.word(10);
          consignmentArgs.outletId.value = randomProduct.inventory[0].outlet_id;
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

              expect(consignmentProductResponse['product_id']).to.exist;
              expect(consignmentProductResponse['product_id']).to.equal(randomProduct.id);
              expect(consignmentProductResponse['consignment_id']).to.exist;
              expect(consignmentProductResponse['consignment_id']).to.equal(consignmentId);

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
              expect(fetchConsignmentByProductIdResponse['product_id']).to.exist;
              expect(fetchConsignmentByProductIdResponse['product_id']).to.equal(randomProduct.id);
              expect(fetchConsignmentByProductIdResponse['consignment_id']).to.exist;
              expect(fetchConsignmentByProductIdResponse['consignment_id']).to.equal(consignmentId);

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
      describe('usecase two', function () {
        var randomProduct, supplier, consignmentProductId, consignmentId;
        it('by preparing a product with a supplier and an outlet', function () {
          return getRandomProduct()
            .then(function (result) {
              randomProduct = result;
              expect(randomProduct).to.exist;
              supplier = randomProduct.supplier;
              expect(supplier).to.exist;
              expect(supplier.id).to.equal(randomProduct['supplier_id']);
            });
        });
        it('by preparing a new consignment', function () {
          var consignmentArgs = vendSdk.args.consignments.stockOrders.create();
          consignmentArgs.name.value = faker.lorem.word(10);
          consignmentArgs.outletId.value = randomProduct.inventory[0].outlet_id;
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

              expect(consignmentProductResponse['product_id']).to.exist;
              expect(consignmentProductResponse['product_id']).to.equal(randomProduct.id);
              expect(consignmentProductResponse['consignment_id']).to.exist;
              expect(consignmentProductResponse['consignment_id']).to.equal(consignmentId);

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
      describe('usecase three', function () {
        var randomProduct, supplier, consignmentProduct, consignment;
        it('by preparing a product with a supplier and an outlet', function () {
          return getRandomProduct()
            .then(function (result) {
              randomProduct = result;
              expect(randomProduct).to.exist;
              supplier = randomProduct.supplier;
              expect(supplier).to.exist;
              expect(supplier.id).to.equal(randomProduct['supplier_id']);
            });
        });
        it('by preparing a new consignment (stock order)', function () {
          var consignmentArgs = vendSdk.args.consignments.stockOrders.create();
          consignmentArgs.name.value = faker.lorem.word(10);
          consignmentArgs.outletId.value = randomProduct.inventory[0].outlet_id;
          consignmentArgs.supplierId.value = supplier.id;
          return vendSdk.consignments.stockOrders.create(consignmentArgs, getConnectionInfo())
            .then(function (createConsignmentResponse) {
              // validate the response after a consignment was created
              expect(createConsignmentResponse).to.exist;
              expect(createConsignmentResponse.id).to.exist;
              expect(createConsignmentResponse.type).to.exist;
              expect(createConsignmentResponse.type).to.be.a('string');
              expect(createConsignmentResponse.type).to.equal('SUPPLIER');
              expect(createConsignmentResponse.status).to.exist;
              expect(createConsignmentResponse.status).to.be.a('string');
              expect(createConsignmentResponse.status).to.equal('OPEN');
              consignment = createConsignmentResponse;
              return Promise.resolve();
            })
            .then(function () { // double check if the consignment really exists or not, try to fetch it explicitly
              var args = vendSdk.args.consignments.fetchById();
              args.apiId.value = consignment.id;
              return vendSdk.consignments.fetchById(args, getConnectionInfo())
                .then(function (fetchConsignmentResponse) {
                  // validate if the consignment really exists or not based on the attempt fetch it explicitly
                  expect(fetchConsignmentResponse).to.exist;
                  expect(fetchConsignmentResponse.id).to.exist;
                  expect(fetchConsignmentResponse.type).to.exist;
                  expect(fetchConsignmentResponse.type).to.be.a('string');
                  expect(fetchConsignmentResponse.type).to.equal('SUPPLIER');
                  expect(fetchConsignmentResponse.status).to.exist;
                  expect(fetchConsignmentResponse.status).to.be.a('string');
                  expect(fetchConsignmentResponse.status).to.equal('OPEN');
                });
            });
        });
        it('by creating a consignment product with ordered/expected quantity', function () {
          var args = vendSdk.args.consignments.products.create();
          args.consignmentId.value = consignment.id;
          args.productId.value = randomProduct.id;
          args.cost.value = faker.random.number(4);
          args.count.value = faker.random.number({min: 5, max: 10}); // set ordered/expected quantity with a random number between 5 and 10
          args.sequenceNumber.value = faker.random.number();
          return vendSdk.consignments.products.create(args, getConnectionInfo())
            .then(function (createConsignmentProductResponse) {
              expect(createConsignmentProductResponse).to.exist;
              expect(createConsignmentProductResponse.id).to.exist;

              /**
               * This assertion would fail if the consignment product wasn't created
               * because of a bad product+supplier+outlet combination. In which case,
               * the vend api decides to send back the consignment (instead of the consignment PRODUCT)
               * to indicate that the work was not performed!
               */
              expect(createConsignmentProductResponse.id).to.not.equal(consignment.id);

              expect(createConsignmentProductResponse['product_id']).to.exist;
              expect(createConsignmentProductResponse['product_id']).to.equal(randomProduct.id);
              expect(createConsignmentProductResponse['consignment_id']).to.exist;
              expect(createConsignmentProductResponse['consignment_id']).to.equal(consignment.id);

              consignmentProduct = createConsignmentProductResponse;
            });
        });
        it('by updating a consignment product with received quantity', function () {
          consignmentProduct.received = faker.random.number({min: 5, max: 10}); // update the received quantity with a random number between 5 and 10
          var args = vendSdk.args.consignments.products.update();
          args.apiId.value = consignmentProduct.id;
          args.body.value = consignmentProduct;
          return vendSdk.consignments.products.update(args, getConnectionInfo())
            .then(function (updatedConsignmentProduct) {
              expect(updatedConsignmentProduct).to.exist;
              expect(updatedConsignmentProduct.id).to.exist;
              expect(updatedConsignmentProduct.id).to.equal(consignmentProduct.id);
              expect(updatedConsignmentProduct['product_id']).to.exist;
              expect(updatedConsignmentProduct['product_id']).to.equal(consignmentProduct.product_id);
              expect(updatedConsignmentProduct['consignment_id']).to.exist;
              expect(updatedConsignmentProduct['consignment_id']).to.equal(consignmentProduct.consignment_id);
              expect(updatedConsignmentProduct['count']).to.exist;
              expect(updatedConsignmentProduct['count']).to.equal(consignmentProduct.count);
              expect(updatedConsignmentProduct['received']).to.exist;
              expect(updatedConsignmentProduct['received']).to.equal(consignmentProduct.received);
              expect(updatedConsignmentProduct['cost']).to.exist;
              expect(updatedConsignmentProduct['cost']).to.equal(consignmentProduct.cost);
              expect(updatedConsignmentProduct['sequence_number']).to.exist;
              expect(updatedConsignmentProduct['sequence_number']).to.equal(consignmentProduct.sequence_number);
            });
        });
        it('by marking the stock order as "sent"', function () {
          var args = vendSdk.args.consignments.stockOrders.markAsSent();
          args.apiId.value = consignment.id;
          args.body.value = consignment; // will be mutated by the method it is passed to unless its cloned before passing
          return vendSdk.consignments.stockOrders.markAsSent(args, getConnectionInfo())
            .then(function (updatedConsignment) {
              expect(updatedConsignment).to.exist;
              expect(updatedConsignment.id).to.equal(consignment.id);
              expect(updatedConsignment.name).to.equal(consignment.name);
              expect(updatedConsignment.consignment_date).to.equal(consignment.consignment_date);
              expect(updatedConsignment.due_at).to.equal(consignment.due_at);
              expect(updatedConsignment.received_at).to.equal(consignment.received_at);
              expect(updatedConsignment.retailer_id).to.equal(consignment.retailer_id);
              expect(updatedConsignment.outlet_id).to.equal(consignment.outlet_id);
              expect(updatedConsignment.supplier_id).to.equal(consignment.supplier_id);
              expect(updatedConsignment.source_outlet_id).to.equal(consignment.source_outlet_id);
              expect(updatedConsignment.status).to.equal('SENT');
              expect(updatedConsignment.status).to.equal(consignment.status);
              expect(updatedConsignment.type).to.equal(consignment.type);
              expect(updatedConsignment.accounts_transaction_id).to.equal(consignment.accounts_transaction_id);
            });
        });
        it('by marking the stock order as "received"', function () {
          var args = vendSdk.args.consignments.stockOrders.markAsReceived();
          args.apiId.value = consignment.id;
          args.body.value = consignment; // will be mutated by the method it is passed to unless its cloned before passing
          return vendSdk.consignments.stockOrders.markAsReceived(args, getConnectionInfo())
            .then(function (updatedConsignment) {
              expect(updatedConsignment).to.exist;
              expect(updatedConsignment.id).to.equal(consignment.id);
              expect(updatedConsignment.name).to.equal(consignment.name);
              expect(updatedConsignment.consignment_date).to.equal(consignment.consignment_date);
              expect(updatedConsignment.due_at).to.equal(consignment.due_at);
              expect(updatedConsignment.received_at).to.exist;
              expect(updatedConsignment.received_at).to.not.equal(consignment.received_at);
              expect(updatedConsignment.retailer_id).to.equal(consignment.retailer_id);
              expect(updatedConsignment.outlet_id).to.equal(consignment.outlet_id);
              expect(updatedConsignment.supplier_id).to.equal(consignment.supplier_id);
              expect(updatedConsignment.source_outlet_id).to.equal(consignment.source_outlet_id);
              expect(updatedConsignment.status).to.equal('RECEIVED');
              expect(updatedConsignment.status).to.equal(consignment.status);
              expect(updatedConsignment.type).to.equal(consignment.type);
              expect(updatedConsignment.accounts_transaction_id).to.equal(consignment.accounts_transaction_id);
            });
        });
      });
    });

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

    describe('with products API', function () {
      this.timeout(300000);

      it('can create a product', function () {
        var args = vendSdk.args.products.create();
        args.body.value = generateNewProductBody();

        return vendSdk.products.create(args, getConnectionInfo())
          .then(function (response) {
            log.debug('response:', response);
            expect(response).to.exist;
            expect(response.product).to.exist;
            expect(response.product.id).to.exist;
          });
      });

      xit('TODO: can fetch a product that was just created', function () {
        // TODO: implement it
      });

      xit('UNVERIFIED: can upload product image', function () {
        // TODO: implement it
      });

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
            if (response.version) {
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
      it('can fetch ALL products w/ default page size', function () { // NOTE: default page size is 1000 based on passive observation
        var args = vendSdk.args.products.fetchAll();
        return vendSdk.products.fetchAll(args, getConnectionInfo()) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allProducts) {
            expect(allProducts).to.exist;
            expect(allProducts).to.be.instanceof(Array);
            productsAcquiredWithDefaultPageSize = allProducts.length;
          });
      });

      var productsAcquiredWithCustomPageSize;
      it('can fetch ALL products w/ custom page size', function () {
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
      it('can fetch ALL products w/ custom processor', function () {
        var customProcessor = function processPagedResults(pagedData, previousData) {
          if (previousData && previousData.length>0) {
            if (pagedData.data && pagedData.data.length>0) {
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

      it('can fetch ALL active and inactive products', function () {
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

      it('TODO: can fetch ALL products w/ inventory data included too', function () {
        return vendSdk.products.fetchAllWithInventory(null, getConnectionInfo())
          .then(function (productsWithInventory) {
            expect(productsWithInventory).to.exist;
            //var strange = [];
            _.each(productsWithInventory, function (product) {
              /*if (product.has_inventory && !product.inventory) {
               strange.push(product); // TODO: ask Vend why has_inventory remains true even when inventory for that product, does not exist
               }*/
              if (product.inventory) {
                expect(product.inventory).to.exist;
                expect(product.inventory).to.be.instanceof(Array);
                expect(product.inventory.length).to.be.greaterThan(0);
                _.each(product.inventory, function (inventoryEntry) {
                  expect(inventoryEntry.product_id).to.equal(product.id);
                });
              }
              else {
                expect(product.inventory).to.be.undefined;
              }
            });
            //console.log('strange.length', strange.length);
            //console.log(strange);
          });
      });
    });

    describe.only('with versions API', function () {
      this.timeout(300000);

      it('can fetch latest versions of all data in Vend', function () {
        return vendSdk.versions.fetchAll(getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.data).to.exist;
            expect(response.data).to.be.instanceof(Object);
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
    });

    describe('with inventory API', function () {

      var getProductsForTesting = function () {
        var args = vendSdk.args.products.fetch();
        args.page.value = 1;
        args.pageSize.value = 5;
        return vendSdk.products.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response.data).to.exist; // otherwise, you may need to expand the test to look for larger # of products
            return Promise.resolve(response.data);
          });
      };

      it('can fetch inventory by product ID', function () {
        return getProductsForTesting()
          .then(function (productsForTesting) {
            var productForTesting = _.find(productsForTesting, function (eachProduct) { // return the first product that fulfills these conditions
              return eachProduct.has_inventory;
            });
            expect(productForTesting).to.exist; // otherwise, you may need to expand the test to look for larger # of products
            var args = vendSdk.args.inventory.fetchByProductId();
            args.apiId.value = productForTesting.id;
            return vendSdk.inventory.fetchByProductId(args, getConnectionInfo())
              .then(function (response) {
                expect(response).to.exist;
                expect(response.data).to.exist;
                expect(response.data).to.be.instanceof(Array);
                expect(response.data).to.have.length.of.at.least(1);
                _.each(response.data, function (inventoryEntry) {
                  expect(inventoryEntry.product_id).to.equal(productForTesting.id);
                });
              });
          });
      });

      it('can fetch inventory w/ default page size', function () {
        var args = vendSdk.args.inventory.fetch();
        return vendSdk.inventory.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.data).to.exist;
            expect(response.data).to.be.instanceof(Array);
            expect(response.data).to.have.length.of.at.least(1);
            expect(response.data).to.have.length.of.at.most(25); // currently observed default - no guarantees
            if (response.version) {
              expect(response.version.min).to.exist;
              expect(response.version.max).to.exist;
            }
          });
      });

      it('can fetch inventory w/ custom page size', function () {
        var args = vendSdk.args.inventory.fetch();
        args.pageSize.value = 5;
        return vendSdk.inventory.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.data).to.exist;
            expect(response.data).to.be.instanceof(Array);
            expect(response.data).to.have.length.of.at.least(1);
            expect(response.data).to.have.length.of.at.most(5);
            if (response.version) {
              expect(response.version.min).to.exist;
              expect(response.version.max).to.exist;
            }
          });
      });

      it('can fetch ALL inventory', function () {
        var args = vendSdk.args.inventory.fetchAll();
        args.pageSize.value = 500; // currently observed maximum - no guarantees - asking for more still gives only 500 per page
        return vendSdk.inventory.fetchAll(args, getConnectionInfo())
          .then(function (inventory) {
            expect(inventory).to.exist;
            expect(inventory).to.be.instanceof(Array);
            expect(inventory).to.have.length.of.at.least(1);
          });
      });
    });

    describe('with customers API', function () {
      var customer = {
        'first_name': 'boy',
        'last_name': 'blue',
        'email': 'boy' + Date.now() + '@blue.com'
      };
      it('can create a customer', function () {
        return vendSdk.customers.create(customer, getConnectionInfo())
          .then(function (response) {
            log.debug('response', response);
          });
      });

      it('can fetch a customer by email', function () {
        // this is just a convenience method
        return vendSdk.customers.fetchByEmail(customer.email, getConnectionInfo())
          .then(function (response) {
            log.debug('response', response);
            expect(response).to.exist;
            expect(response).to.be.instanceof(Object);
            expect(response.customers).to.exist;
            expect(response.customers).to.be.instanceof(Array);
            expect(response.customers.length).to.be.equal(1);
            expect(response.customers[0].first_name).to.be.equal(customer.first_name);
            expect(response.customers[0].last_name).to.be.equal(customer.last_name);
            expect(response.customers[0].email).to.be.equal(customer.email);
          });
      });

      it('can fetch ALL customers', function () {
        var args = vendSdk.args.customers.fetchAll();
        return vendSdk.customers.fetchAll(args, getConnectionInfo())
          .then(function (customers) {
            expect(customers).to.exist;
            expect(customers).to.be.instanceof(Array);
            expect(customers.length).to.be.greaterThan(0);
            log.debug('can fetch ALL customers', 'customers.length:', customers.length);
          });
      });
    });

    describe('with registers API', function () {
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
    });

    describe('with tags API', function () {
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
    });

    describe('with outlets API', function () {
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
    });

    describe('with product types API', function () {
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
    });

    describe('with brands API', function () {
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
    });

    describe('with suppliers API', function () {
      var supplier;
      it('can create a supplier', function () {
        var args = vendSdk.args.suppliers.create();
        args.body.value = {
          'name': faker.company.companyName(), // REQUIRED
          //'supplier_code': faker.finance.accountName() // there is some uncertainity about where this field belongs and how it functions
        };
        return vendSdk.suppliers.create(args, getConnectionInfo())
          .then(function (response) {
            log.debug('response:', response);
            expect(response).to.exist;
            supplier = response;
            expect(supplier.id).to.exist;
            expect(supplier.retailer_id).to.exist;
            expect(supplier.name).to.equal(args.body.value.name);
            expect(supplier.contact).to.exist;
            expect(supplier.contact.company_name).to.equal(args.body.value.name);
          });
      });

      it('cannot create a supplier without name', function () {
        var args = vendSdk.args.suppliers.create();
        args.body.value = {
          'description': faker.company.companyName()
        };
        return vendSdk.suppliers.create(args, getConnectionInfo())
          .then(function (response) {
            log.debug('response:', response);
            expect(response).to.exist;
            expect(response.status).to.exist;
            expect(response.status).to.be.a('string');
            expect(response.status).to.equal('error');
            expect(response.error).to.exist;
            expect(response.error).to.be.a('string');
            expect(response.error).to.equal('Could not Add Supplier');
            expect(response.details).to.exist;
            expect(response.details).to.be.a('string');
            expect(response.details).to.equal('Supplier creation error. Please ensure you pass the required field(s) of: name.');
          });
      });

      it('can delete a supplier', function () {
        var args = vendSdk.args.suppliers.delete();
        args.apiId.value = supplier.id;
        return vendSdk.suppliers.delete(args, getConnectionInfo())
          .then(function (response) {
            log.debug('response:', response);
            expect(response).to.exist;
            expect(response.status).to.exist;
            expect(response.status).to.be.a('string');
            expect(response.status).to.equal('success');
          });
      });
    });

    describe('with taxes API', function () {
      it('UNVERIFIED: can create a tax', function () {
        // TODO: implement it
      });
    });

    describe('with users API for v2.0', function () {
      this.timeout(300000);
      var productsAcquiredFromVanillaCall, productsAcquiredFromExoticCall;
      it('can fetch ALL users', function () { // NOTE: default page size is 1000 based on passive observation

        var args = vendSdk.args.users.fetchAll();
        return vendSdk.users.fetchAll(args, getConnectionInfo()) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allUsers) {
            //log.debug('can fetch ALL products', 'allProducts:', allProducts);
            expect(allUsers).to.exist;
            expect(allUsers).to.be.instanceof(Array);
            productsAcquiredFromVanillaCall = allUsers.length;
            //log.debug('can fetch ALL products', 'allProducts.length:', allProducts.length);
          });
      });

      it('can fetch ALL users w/ custom page size', function () {
        var args = vendSdk.args.users.fetchAll();
        args.pageSize.value = 10;
        return vendSdk.users.fetchAll(args, getConnectionInfo()) // NOTE: 3rd (optional) argument can be a custom method to processPagedResults
          .then(function (allUsers) {
            //log.debug('can fetch ALL products w/ custom page size', 'allProducts:', allProducts);
            expect(allUsers).to.exist;
            expect(allUsers).to.be.instanceof(Array);
            productsAcquiredFromExoticCall = allUsers.length;
            expect(productsAcquiredFromExoticCall).to.be.equal(productsAcquiredFromVanillaCall);
            //log.debug('can fetch ALL products w/ custom page size', 'allProducts.length:', allProducts.length);
          });
      });

      it('can fetch users', function () {

        var args = vendSdk.args.users.fetch();
        args.page.value = 1;
        args.pageSize.value = 5;

        return vendSdk.users.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.users).to.exist;
            expect(response.users).to.be.instanceof(Array);
            expect(response.users).to.have.length.of.at.least(1);
            expect(response.users).to.have.length.of.at.most(5);
            if (response.pagination) {/*jshint camelcase: false */
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

      it('can paginate when fetching users', function () {
        var args = vendSdk.args.users.fetch();
        args.page.value = 1;
        args.pageSize.value = 1;
        return vendSdk.users.fetch(args, getConnectionInfo())
          .then(function (response) {
            expect(response).to.exist;
            expect(response.users).to.exist;
            expect(response.users).to.be.instanceof(Array);
            expect(response.users.length).to.equal(1);
          });
      });
    });

  });

});
