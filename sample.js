// To run via terminal from within vend-oauth-example, use:
//   NODE_ENV=development node node_modules/vend-nodejs-sdk/sample.js
// To run via terminal from within vend-nodejs-sdk, use:
//   NODE_ENV=dev node sample.js

//console.log('process.env.NODE_ENV', process.env.NODE_ENV);
var nconf = require('nconf');
nconf.argv()
  .env()
  .file('config', { file: 'config/' + process.env.NODE_ENV + '.json' })
  .file('oauth', { file: 'oauth.txt' });
//console.log('nconf.get(): ', nconf.get());

var _ = require('underscore');

var vend = require('./vend');

var args = vend.args.products.fetch();
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

vend.products.fetch(args, connectionInfo)
  .then(function(response){
    console.log('done\n=====');
    //console.log('response: ', response);
    _.each(response.products, function(product){
      console.log(product.id + ' : ' + product.name);
    });

    // fetch a product by ID
    var args = vend.args.products.fetchById();
    args.apiId.value = _.last(response.products).id;
    return vend.products.fetchById(
      args,
      connectionInfo
    );
  })
  .then(function(response){
    // create a dummy customer
    return vend.customers.create(
      {
        'first_name': 'boy',
        'last_name': 'blue',
        'email': 'boy1@blue.com'
      },
      connectionInfo
    );
  })
  .then(function(response){
    console.log('done\n=====');
    console.log('response: ', response);
  })
  .catch(function(e) {
    console.error('sample.js - An unexpected error occurred: ', e);
  });
