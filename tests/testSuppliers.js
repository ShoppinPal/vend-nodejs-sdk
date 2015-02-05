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

var vendSdk = require('./../vend')({});

var args = {
  page:{value: 1},
  pageSize:{value: 200}
}
vendSdk.suppliers.fetch(args, connectionInfo) // (1) example: fetch suppliers
  .then(function(response) {
    //console.log('response: ', response);
    console.log('response.suppliers.length: ', response.suppliers.length);

    //pagination info, if any
    console.log('response.results: ' + response.results);
    console.log('response.page: ' + response.page);
    console.log('response.page_size: ' + response.page_size);
    console.log('response.pages: ' + response.pages);

    // NOTE: output in terminal/cmd-promopt may show it as `contact: [Object]` at times
    //       but contact info is there, you can validate by specifically printing it out
    //console.log(_.pluck(response.suppliers, 'contact'));

    console.log('====done with example 1====');

    return Promise.resolve(response.suppliers[0].id); // hoping there is at least one supplier for testing the next example
  })
  .then(function(supplierId) { // (2) example: fetch a supplier by id
    var args = {
      apiId:{value: supplierId}
    }
    return vendSdk.suppliers.fetchById(args, connectionInfo)
      .then(function(response) {
        console.log('response: ', response);
        console.log('====done with example 2====');
      });
  })
  .catch(function(e) {
    console.error('testConsignments.js - An unexpected error occurred: ', e);
  });
