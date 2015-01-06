var nconf = require('nconf');
nconf.argv()
  .env()
  .file({ file: 'config/' + process.env.NODE_ENV + '.json' });

var Vend = require('./vend').Vend;
var vend = new Vend(
  nconf.get('subdomain'),
  nconf.get('username'),
  nconf.get('password'));

vend.fetchProducts();
