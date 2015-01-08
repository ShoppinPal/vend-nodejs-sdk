var Vend = (function() {
  'use strict';

  //var Promise = require('bluebird');
  var _ = require('underscore');
  var request = require('request-promise');
  //request.debug = true;

  function Vend(domainPrefix, accessToken) {
    this.domainPrefix = domainPrefix;
    this.accessToken = accessToken;
    this.url = 'https://' + this.domainPrefix + '.vendhq.com';
    //console.log(this.url);
  }

  function RateLimitingError(e) {
    return e.statusCode == 429;
  }

  function ClientError(e) {
    return e.statusCode >= 400 && e.statusCode < 500;
  }

  Vend.prototype.fetchProducts = function(parameters){
    var path = '/api/products';
    var authString = 'Bearer ' + this.accessToken;
    var url = this.url + path;
    //var domainPrefix = this.domainPrefix;

    //console.log('GET ' + url);
    //console.log('Authorization: ' + authString);
    var options = {
      url: url,
      headers: {
        'Authorization': authString
      }
    };

    request(options)
      .then(function(response) {
        if(_.isArray(response)) {
          console.log('response is an array');
        } else if(_.isObject(response)) {
          console.log('response is an object');
        } else if(_.isString(response)) {
          console.log('response is a string');
          try{
            var responseObject = JSON.parse(response);
            console.log('Fetched ' + responseObject.products.length + ' products');
          } catch(error){
            console.error('caught an error: ', error);
            throw error;
          }
        } else {
          console.log(response);
        }
      })
      .catch(RateLimitingError, function(e) {
        console.log('A RateLimitingError error like "429 Too Many Requests" happened: '
          + e.statusCode + ' ' + e.response.body + '\n'
          + JSON.stringify(e.response.headers,null,2));
      })
      .catch(ClientError, function(e) {
        console.log('A ClientError happened: '
          + e.statusCode + ' ' + e.response.body + '\n'
          /*+ JSON.stringify(e.response.headers,null,2)
          + JSON.stringify(e,null,2)*/
        );
        // TODO: add retry logic
        //       perhaps use: https://github.com/you21979/node-limit-request-promise
        /*Promise.delay(3000)
          .then(function() {
            console.log("3000 ms passed");
            return new Vend(domainPrefix).fetchProducts(parameters);
          });*/
      })
      .catch(function(e) {
        console.error('An unexpected error occurred: ', e);
      });
  };

  return Vend;
})();

exports.Vend = Vend;