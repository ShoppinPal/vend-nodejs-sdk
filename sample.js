// To run via terminal use: NODE_ENV=dev node sample.js

//console.log('process.env.NODE_ENV', process.env.NODE_ENV);
var nconf = require('nconf');
nconf.argv()
  .env()
  .file('config', { file: 'config/' + process.env.NODE_ENV + '.json' })
  .file('oauth', { file: 'oauth.txt' });
//console.log('nconf.get(): ', nconf.get());

var vend = require('./vend');

vend.fetchProducts(
  nconf.get('domain_prefix'),
  nconf.get('access_token')
)
  .then(function(products){
    console.log('done');
    //console.log('products: ', products);
  });
