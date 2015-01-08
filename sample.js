// To run via terminal use: NODE_ENV=dev node sample.js

//console.log('process.env.NODE_ENV', process.env.NODE_ENV);
var nconf = require('nconf');
nconf.argv()
  .env()
  .file({ file: 'config/' + process.env.NODE_ENV + '.json' });
//console.log('nconf.get(): ', nconf.get());

var Vend = require('./vend').Vend;
var vend = new Vend(
  nconf.get('domain_prefix'),
  nconf.get('access_token')
);

vend.fetchProducts()
  .then(function(products){
    console.log('products: ', products);
  });
