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
var _ = require('lodash');
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

    describe.only('with sales API', function(){

      describe('this will create a sale with all the relevant data', function () {

        var customerData, taxData, registers, paymentType;

        var registerSale = { /* eslint-disable camelcase */
          register_id: null,
          customer_id: null,
          register_sale_products: [],
          register_sale_payments: [],
          note: 'This sale is created by a test. All data points are added to the sale object.',
          status: 'CLOSED',
          sale_date: new Date().toString(),
          short_code: faker.random.word()
        }; /* eslint-enable camelcase */

        var createPaymentTypesArray = function (paymentTypesArray) {
          paymentType = _.sampleSize(paymentTypesArray, 1);
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

        var prepareRegisterSaleProduct = function (product) {
          var data = { /* eslint-disable camelcase */
            register_id: registers.id,
            product_id: product.id,
            quantity: 1,
            price: product.supply_price,
            tax: (taxData.rate * product.supply_price),
            tax_id: taxData.id
          }; /* eslint-enable camelcase */
          return registerSale.register_sale_products.push(data);
        };

        var createRegisterSalePayments = function (payment) {
          log.debug('The payment that will be attached to the sale', payment);
          return registerSale.register_sale_payments.push({ /* eslint-disable camelcase */
            amount: 9.99,
            retailer_payment_type_id: payment.id,
            register_id: registers.id,
            payment_date: new Date().toString()
          }); /* eslint-enable camelcase */
        };

        var addMoreRegisterSaleProducts = function (productsArray) {
          return _.each(productsArray, function (product) {
            //console.log(product.id, product.tax, product.tax_id, JSON.stringify(product,null,2));
            prepareRegisterSaleProduct(product);
            // if (registerSale.register_sale_products.indexOf(data) === -1) {
            //   return registerSale.register_sale_products.push(data)
            // }
          });
        };

        it('can create a customer that will be further get attached to a sale', function () {
          var customer = {
            'first_name': faker.name.firstName(),
            'last_name': faker.name.lastName(),
            'email': faker.lorem.word() + '@tinkertank.com'
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
              return _.sampleSize(response.registers, 1);
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
          args.body.value = generateNewProductBody();

          return vendSdk.products.create(args, getConnectionInfo())
            .then(function (response) {
              log.debug('Product Response', response);
              return response.product; // this is 0.x response to product creation
            })
            .then(function (product) {
              prepareRegisterSaleProduct(product);
            });
        });

        it('can fetch products and add them to the register sale products array', function () {
          var args = vendSdk.args.products.fetch();
          args.page.value = 1;
          args.pageSize.value = 200;
          return vendSdk.products.fetch(args, getConnectionInfo()) // this is 2.x response to fetch products
            .then(function (response) {
              return Promise.resolve(_.filter(response.data, function (item) {
                return item.supply_price > 0;
              }));
            })
            .then(function (sampleResponse) {
              return _.sampleSize(sampleResponse, 2);
            })
            .then(function (products) {
              addMoreRegisterSaleProducts(products);
            });
        });

        it('can fetch all payment types', function () {
          var args = vendSdk.args.paymentTypes.fetch();
          return vendSdk.paymentTypes.fetch(args, getConnectionInfo())
            .then(function (response) {
              log.debug(response);
              return response.payment_types;
            })
            .then(function (paymentTypes) {
              return Promise.resolve(createPaymentTypesArray(paymentTypes));
            })
            .then(function (arrayResponse) {
              createRegisterSalePayments(arrayResponse);
            });
        });

        var registerSale;
        it('can create a register sale', function () {
          registerSale.customer_id = customerData.id; // eslint-disable-line camelcase
          registerSale.register_id = registers.id; // eslint-disable-line camelcase
          return vendSdk.sales.create(registerSale, getConnectionInfo())
            .then(function (saleResponse) {
              log.debug('SALE-RESPONSE', JSON.stringify(saleResponse, undefined, 2));
              expect(saleResponse).to.exist;
              expect(saleResponse.register_sale).to.exist;
              expect(saleResponse.register_sale.id).to.exist;
              expect(saleResponse.register_sale.customer_id).to.exist;
              expect(saleResponse.register_sale.customer_id).to.equal(customerData.id);
              expect(saleResponse.register_sale.register_id).to.exist;
              expect(saleResponse.register_sale.register_id).to.equal(registers.id);
              expect(saleResponse.register_sale.register_sale_payments).to.exist;
              expect(saleResponse.register_sale.register_sale_payments).to.exist;
              expect(saleResponse.register_sale.register_sale_payments).to.be.instanceOf(Array);
              expect(saleResponse.register_sale.register_sale_payments.length).to.equal(1);
              expect(saleResponse.register_sale.register_sale_products).to.exist;
              expect(saleResponse.register_sale.register_sale_products).to.be.instanceOf(Array);
              expect(saleResponse.register_sale.register_sale_products.length).to.equal(3);
              registerSale = saleResponse.register_sale;
              //console.log(JSON.stringify(registerSale, null, 2));
            });
        });

        /**
         * Conclusion - the response from fetch by ID for 0.x can be used for updates
         */
        it('re-posting a sale which was fetched by ID from 0.x endpoints "as-is", does not destroy any data', function() {
          var argsFor0x = vendSdk.args.sales.fetchById();
          argsFor0x.apiId.value = registerSale.id;
          argsFor0x.apiVersion.value = '0.9';

          var argsFor2x = vendSdk.args.sales.fetchById();
          argsFor2x.apiId.value = registerSale.id;
          argsFor2x.apiVersion.value = '2.0';

          return Promise.delay(5000) // things like loyalty/balance can continue to mutate between consecutive fetches, soon after a sale is created/updated
            .then(function(){
              return vendSdk.sales.fetchById(argsFor0x, getConnectionInfo())
                .then(function (response1) {
                  //console.log('fetched by id w/ 0.x once', '\n', JSON.stringify(response1.register_sales[0], null, 2));
                  var fetchedById0xSale1 = response1.register_sales[0];
                  // fetch it again for comparison
                  return vendSdk.sales.fetchById(argsFor0x, getConnectionInfo())
                    .then(function (response2) {
                      //console.log('fetched by 0.x id w/0.x twice', '\n', JSON.stringify(response2.register_sales[0], null, 2));
                      var fetchedById0xSale2 = response2.register_sales[0];

                      expect(fetchedById0xSale1).to.deep.equal(fetchedById0xSale2);

                      return vendSdk.sales.fetchById(argsFor2x, getConnectionInfo())
                        .then(function (response5) {
                          //console.log('fetched by id w/ 2.x', '\n', JSON.stringify(response5.data, null, 2));
                          var fetchedById2xSale1 = response5.data;

                          // re-posting the 0.x fetched body as-is
                          return vendSdk.sales.create(fetchedById0xSale1, getConnectionInfo())
                            .then(function (/*response3*/) {
                              /*console.log('\n\n\n',JSON.stringify(response3, null, 2));*/
                              return Promise.delay(5000) // things like loyalty/balance can continue to mutate between consecutive fetches, soon after a sale is created/updated
                                .then(function(){
                                  return vendSdk.sales.fetchById(argsFor0x, getConnectionInfo())
                                    .then(function (response4) {
                                      //console.log('fetched by id after re-post', '\n', JSON.stringify(response4.register_sales[0], null, 2));
                                      var fetchedById0xSale3 = response4.register_sales[0];
                                      fetchedById0xSale1 = _.omit(fetchedById0xSale1, 'updated_at')
                                      fetchedById0xSale3 = _.omit(fetchedById0xSale3, 'updated_at')

                                      // nothing should have changed before a repost and after a repost based on 0.x get by ids
                                      expect(fetchedById0xSale1).to.deep.equal(fetchedById0xSale3);

                                      return vendSdk.sales.fetchById(argsFor2x, getConnectionInfo())
                                        .then(function (response6) {
                                          //console.log('fetched by id w/ 2.x', '\n', JSON.stringify(response6.data, null, 2));
                                          var fetchedById2xSale2 = response6.data;
                                          fetchedById2xSale1 = _.omit(fetchedById2xSale1, ['updated_at','version']);
                                          fetchedById2xSale2 = _.omit(fetchedById2xSale2, ['updated_at','version']);

                                          // nothing should have changed before a repost and after a repost based on 2.x get by ids
                                          expect(fetchedById2xSale1).to.deep.equal(fetchedById2xSale2);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

      });

    });

  });

});
