// To run via terminal from within vend-oauth-example, use:
//   NODE_ENV=development node node_modules/vend-nodejs-sdk/tests/testConsignments.js
// To run via terminal from within vend-nodejs-sdk, use:
//   NODE_ENV=dev node tests/testConsignments.js

//console.log('process.env.NODE_ENV', process.env.NODE_ENV);
var nconf = require('nconf');
nconf.argv()
  .env()
  .file('config', { file: 'config/' + process.env.NODE_ENV + '.json' })
  .file('oauth', { file: 'oauth.txt' });
//console.log('nconf.get(): ', nconf.get());

var _ = require('underscore');
var Promise = require('bluebird');

var vendSdk = require('./../vend')({});

var args = vendSdk.args.products.fetch();
args.orderBy.value = 'id';
args.page.value = 1;
args.pageSize.value = 5;
args.active.value = true;

// (a) this info is sufficient for a non-expired access_token
/*var connectionInfo = {
  domainPrefix: nconf.get('domain_prefix'),
  accessToken: nconf.get('access_token')
};*/

// (b) you may simulate 401 retry by messing up access_token in the oauth.txt file and using this block
var connectionInfo = {
  domainPrefix: nconf.get('domain_prefix'),
  accessToken: nconf.get('access_token'),
  // if you want auto-reties on 401, additional data is required:
  refreshToken: nconf.get('refresh_token'), // oauth.txt
  vendTokenService: nconf.get('vend:token_service'), // config/<env>.json
  vendClientId: nconf.get('vend:client_id'), // config/<env>.json
  vendClientSecret: nconf.get('vend:client_secret') // config/<env>.json
};

// (c) you may simulate 401 retry FAILURE by messing up access_token in the oauth.txt file and using this block
/*var connectionInfo = {
  domainPrefix: nconf.get('domain_prefix'),
  accessToken: nconf.get('access_token')
};*/

//console.log('connectionInfo: ', connectionInfo);

var pageSize = 2;
vendSdk.consignments.stockOrders.fetch({ // (1) example: fetch a single consignment
    page: {value: 1},
    pageSize: {value: 1}
  },
  connectionInfo
)
  .then(function(response) {
    //console.log('response: ', response);
    console.log(response.results);
    console.log(response.page);
    console.log(response.page_size);
    console.log(response.pages);
    console.log(Math.ceil(response.results / pageSize));

    console.log('====done with example 1====');
    return Promise.resolve(Math.ceil(response.results / pageSize)); // helps with next example
  })
  .then(function(lastPageNumber) {
    return vendSdk.consignments.stockOrders.fetch({ // (2) example: fetch the last page of consignments
        page: lastPageNumber,
        pageSize: {value: pageSize}
      },
      connectionInfo
    )
      .then(function(response){
        console.log(response.results);
        console.log(response.page);
        console.log(response.page_size);
        console.log(response.pages);
        console.log('response.consignments.length: ', response.consignments.length);

        console.log('====done with example 2====');
        return Promise.resolve(); // continue the promise chain
      });
  })
  .then(function(){ // (3) example: fetch all SUPPLIER consigments that were received after 2015-01-25
    return vendSdk.consignments.stockOrders.fetchAll(
      connectionInfo,
      function(pagedData, previousData){ // example of how to REDUCE paged data in a custom fashion
        console.log('pagedData: ', pagedData.consignments.length);
        var moment = require('moment');
        var consignmentsAfterDateX = _.filter(pagedData.consignments, function(consignment){
          return consignment.received_at &&
            moment(consignment.received_at).isAfter('2015-01-25')
            && consignment.type === 'SUPPLIER';
          // TODO: will eventually have an end of the week date range comaprison, too
        });
        console.log('consignmentsAfterDateX: ', consignmentsAfterDateX.length);
        //console.log('consignmentsAfterDateX: ', consignmentsAfterDateX);

        if (previousData && previousData.length>0 && consignmentsAfterDateX.length>0) {
          console.log('previousData: ', previousData.length);
          consignmentsAfterDateX = consignmentsAfterDateX.concat(previousData);
          console.log('combined: ', consignmentsAfterDateX.length);
        }
        return Promise.resolve(consignmentsAfterDateX); // why do we need a promise?
      });
  })
  .then(function(allConsignmentsAfterDateX){
    //console.log('allConsignmentsAfterDateX: ', allConsignmentsAfterDateX);
    console.log('allConsignmentsAfterDateX.length: ', allConsignmentsAfterDateX.length);
    console.log('====done with example 3====');

    // (4) example: fetch all products for a given consigment id
    /*return vendSdk.consignments.products.fetchAllByConsignment({
        consignmentId: {value: allConsignmentsAfterDateX[0].id}
      },
      connectionInfo
    )*/

    // (5) example: iterate through a collection of consignments and get consignment products for all of them together
    return vendSdk.consignments.products.fetchAllForConsignments({
        consignmentIds: {value: _.pluck(allConsignmentsAfterDateX, 'id')}
      },
      connectionInfo
    )
      .then(function(allProductsForConsignments){
        console.log('====done with example 4====');
        //console.log('response: ', allProductsForConsignments);

        var consignmentsMap = _.object(_.map(allConsignmentsAfterDateX, function(consignment) {
          return [consignment.id, consignment]
        }));

        var costPerOutletPerSupplier = {};

        // NOTE: each consignment is mapped to exactly one supplier_id and one outlet_id

        // sum the costs per outlet per supplier
        _.each(allProductsForConsignments, function(consignmentProduct){
          var outletId = consignmentsMap[consignmentProduct.consignment_id].outlet_id;
          var supplierId = consignmentsMap[consignmentProduct.consignment_id].supplier_id;
          console.log('outletId: ' + outletId + ' supplier_id: ' + supplierId);
          if (!costPerOutletPerSupplier[outletId]) {
            costPerOutletPerSupplier[outletId] = {};
          }
          if (!costPerOutletPerSupplier[outletId][supplierId]) {
            costPerOutletPerSupplier[outletId][supplierId] = 0.0;
          }
          var cost = consignmentProduct.cost * Math.abs(consignmentProduct.received);
          costPerOutletPerSupplier[outletId][supplierId] += cost;
        });
        console.log(costPerOutletPerSupplier);
      });
  })
  .catch(function(e) {
    console.error('testConsignments.js - An unexpected error occurred: ', e);
  });
