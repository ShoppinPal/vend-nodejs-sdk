'use strict';

var _ = require('underscore');
var log = require('winston');
var Promise = require('bluebird');

var request = require('request-promise');
//request.debug = true;

function RateLimitingError(e) {
  return e.statusCode == 429;
}

function ClientError(e) {
  return e.statusCode >= 400 && e.statusCode < 500;
}

var successHandler = function(response) {
  if(_.isArray(response)) {
    console.log('response is an array');
  } else if(_.isObject(response)) {
    console.log('response is an object');
  } else if(_.isString(response)) {
    console.log('response is a string');
    try{
      var responseObject = JSON.parse(response);
      console.log(responseObject);
      return Promise.resolve(responseObject);
    } catch(error){
      console.error('caught an error: ', error);
      throw error;
    }
  } else {
    console.log(response);
  }
};

var fetchProducts = function(domainPrefix, accessToken){
  var path = '/api/products';
  var vendUrl = 'https://' + domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString);

  //var domainPrefix = this.domainPrefix;

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString
    }
  };

  return request(options)
    .then(successHandler)
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

var getInitialAccessToken = function(tokenUrl, clientId, clientSecret, redirectUri, code, domainPrefix, state) {
  // TODO: tweak winston logs to prefix method signature (like breadcrumbs) when logging?
  log.debug('getInitialAccessToken - token Url: '+ tokenUrl);
  log.debug('getInitialAccessToken - client Id: ' + clientId);
  log.debug('getInitialAccessToken - client Secret: ' + clientSecret);
  log.debug('getInitialAccessToken - redirect Uri: ' +  redirectUri);
  log.debug('getInitialAccessToken - code: ' + code);
  log.debug('getInitialAccessToken - domain_prefix: ' + domainPrefix);
  log.debug('getInitialAccessToken - state: ' + state);

  var options = {
    url: tokenUrl,
    headers: {
      'Accept': 'application/json'
    },
    form:{
      'code': code,
      'client_id': clientId,
      'client_secret': clientSecret,
      'grant_type': 'authorization_code',
      'state': state,
      'redirect_uri': redirectUri
    }
  };
  return request.post(options)
    .then(successHandler)
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

exports.fetchProducts = fetchProducts;
exports.getInitialAccessToken = getInitialAccessToken;