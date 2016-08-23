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

// (1) example: fetch outlets
vendSdk.outlets.fetch({}, connectionInfo)
  .then(function(response) {
    //console.log('response: ', response);
    console.log('response.outlets.length: ', response.outlets.length);

    console.log('====done with example 1====');
  })
  .catch(function(e) {
    console.error('testConsignments.js - An unexpected error occurred: ', e);
  });
