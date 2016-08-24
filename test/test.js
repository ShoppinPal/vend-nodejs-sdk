'use strict';

var nconf = require('nconf');
nconf.argv()
  .env()
  .file('config', { file: 'config/' + process.env.NODE_ENV + '.json' })
  .file('oauth', { file: 'oauth.txt' });

var expect = require('chai').expect;
var vendSdk = require('./../vend')({});

describe('vend-nodejs-sdk', function() {

    describe('when refreshToken is unavailable', function() {

        it('should fail when given an incorrect or outdated or missing accessToken', function() {

            var args = vendSdk.args.products.fetch();
            args.orderBy.value = 'id';
            args.page.value = 1;
            args.pageSize.value = 5;
            args.active.value = true;

            var connectionInfo = {
                domainPrefix: nconf.get('domain_prefix'),
                accessToken: nconf.get('access_token')
            };

            return vendSdk.products.fetch(args, connectionInfo)
                .catch(function(error){
                    expect(error).to.be.a('string');
                    expect(error).to.equal('missing required arguments for sendRequest()');
                });
        });

    });

});
