// To run via terminal use: NODE_ENV=dev node sample.js

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

var connectionInfo = {
  domainPrefix: nconf.get('domain_prefix'),
  accessToken: nconf.get('access_token')
};

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
    console.log('done\n=====');
    console.log('response: ', response);
  })
  .catch(function(e) {
    console.error('An unexpected error occurred: ', e);
  });
