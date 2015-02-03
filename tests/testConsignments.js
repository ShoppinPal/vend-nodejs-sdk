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

var pageSize = 10;
vendSdk.consignments.stockOrders.fetch({
    page: {value: 1},
    pageSize: {value: 1}/*,
    orderBy: {value: 'updated_at'},
    orderDirection: {value: 'DESC'}*/
  },
  connectionInfo
)
  .then(function(response){
    console.log('done111\n=====');
    //console.log('response: ', response);
    console.log(response.results);
    console.log(response.page);
    console.log(response.page_size);
    console.log(response.pages);
    console.log(Math.ceil(response.results/pageSize));
    return vendSdk.consignments.stockOrders.fetch({
        page: {value: Math.ceil(response.results/pageSize)},
        pageSize: {value: pageSize}
      },
      connectionInfo
    )
      .then(function(response){
        console.log('done222\n=====');
        console.log(response.results);
        console.log(response.page);
        console.log(response.page_size);
        console.log(response.pages);
        console.log('response: ', response.consignments.length);
        var moment = require('moment');
        var consignmentsAfterDateX = _.filter(response.consignments, function(consignment){
          return moment(consignment.received_at).isAfter('2015-01-25') && consignment.type === 'SUPPLIER';

          // will eventually need this limit it to the end of the week to (date ranges really)
        });
        console.log('consignmentsAfterDateX: ', consignmentsAfterDateX.length);
        console.log('consignmentsAfterDateX: ', consignmentsAfterDateX);

      });
  })
  .catch(function(e) {
    console.error('testConsignments.js - An unexpected error occurred: ', e);
  });
