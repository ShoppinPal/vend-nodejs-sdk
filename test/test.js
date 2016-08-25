'use strict';

var nconf = require('nconf');
//nconf.argv().env();

var expect = require('chai').expect;

var vendSdk = require('./../vend')({});

describe('vend-nodejs-sdk', function() {/*jshint expr: true*/

    describe('requires proper configuration to run tests', function() {
        it('NODE_ENV must be set', function() {
            expect(process.env.NODE_ENV).to.exist;
            expect(process.env.NODE_ENV).to.be.a('string');
            expect(process.env.NODE_ENV).to.not.be.empty;
        });
        it('a file with client data must be available', function() {
            nconf.file('config', { file: 'config/' + process.env.NODE_ENV + '.json' });

            expect(nconf.get('vend:token_service')).to.exist;
            expect(nconf.get('vend:token_service')).to.be.a('string');
            expect(nconf.get('vend:token_service')).to.not.be.empty;

            expect(nconf.get('vend:client_id')).to.exist;
            expect(nconf.get('vend:client_id')).to.be.a('string');
            expect(nconf.get('vend:client_id')).to.not.be.empty;

            expect(nconf.get('vend:client_secret')).to.exist;
            expect(nconf.get('vend:client_secret')).to.be.a('string');
            expect(nconf.get('vend:client_secret')).to.not.be.empty;
        });
        it('a file with oauth data must be available', function() {
            nconf.file('oauth', { file: 'config/oauth.json' });

            expect(nconf.get('domain_prefix')).to.exist;
            expect(nconf.get('domain_prefix')).to.be.a('string');
            expect(nconf.get('domain_prefix')).to.not.be.empty;

            expect(nconf.get('refresh_token')).to.exist;
            expect(nconf.get('refresh_token')).to.be.a('string');
            expect(nconf.get('refresh_token')).to.not.be.empty;
        });
    });

    describe('when refreshToken is unavailable', function() {

        it('should fail when accessToken is missing', function() {

            var args = vendSdk.args.products.fetch();
            args.orderBy.value = 'id';
            args.page.value = 1;
            args.pageSize.value = 5;
            args.active.value = true;

            var connectionInfo = {
                domainPrefix: nconf.get('domain_prefix')
            };

            return vendSdk.products.fetch(args, connectionInfo)
                .catch(function(error){
                    expect(error).to.be.a('string');
                    expect(error).to.equal('missing required arguments for sendRequest()');
                });
        });

        it('should fail when given an incorrect or outdated accessToken', function() {

            var args = vendSdk.args.products.fetch();
            args.orderBy.value = 'id';
            args.page.value = 1;
            args.pageSize.value = 5;
            args.active.value = true;

            var connectionInfo = {
                domainPrefix: nconf.get('domain_prefix'),
                accessToken: nconf.get('access_token') || 'junk'
            };

            return vendSdk.products.fetch(args, connectionInfo)
                .catch(function(error){
                    expect(error).to.be.a('string');
                    expect(error).to.equal('missing required arguments for retryWhenAuthNFails()');
                });
        });

    });

});
