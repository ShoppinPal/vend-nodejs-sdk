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

var getTokenUrl = function(tokenService, domain_prefix){
  var tokenUrl = tokenService.replace(/\{DOMAIN_PREFIX\}/, domain_prefix);
  log.debug('token Url: '+ tokenUrl);
  return tokenUrl;
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

var getInitialAccessToken = function(tokenService, clientId, clientSecret, redirectUri, code, domainPrefix, state) {
  // TODO: tweak winston logs to prefix method signature (like breadcrumbs) when logging?
  log.debug('getInitialAccessToken - token_service: ' + tokenService);
  log.debug('getInitialAccessToken - client Id: ' + clientId);
  log.debug('getInitialAccessToken - client Secret: ' + clientSecret);
  log.debug('getInitialAccessToken - redirect Uri: ' +  redirectUri);
  log.debug('getInitialAccessToken - code: ' + code);
  log.debug('getInitialAccessToken - domain_prefix: ' + domainPrefix);
  log.debug('getInitialAccessToken - state: ' + state);

  var tokenUrl = getTokenUrl(tokenService, domainPrefix);

  var options = {
    url: tokenUrl,
    headers: {
      'Accept': 'application/json'
    },
    form:{
      'grant_type': 'authorization_code',
      'client_id': clientId,
      'client_secret': clientSecret,
      'code': code,
      'redirect_uri': redirectUri,
      'state': state
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
    })
    .catch(function(e) {
      console.error('An unexpected error occurred: ', e);
    });
};

var refreshAccessToken = function(tokenService, clientId, clientSecret, refreshToken, domainPrefix) {
  // TODO: tweak winston logs to prefix method signature (like breadcrumbs) when logging?
  log.debug('refreshAccessToken - token service: ' + tokenService);
  log.debug('refreshAccessToken - client Id: ' + clientId);
  log.debug('refreshAccessToken - client Secret: ' + clientSecret);
  log.debug('refreshAccessToken - refresh token: ' +  refreshToken);
  log.debug('refreshAccessToken - domain prefix: ' + domainPrefix);

  var tokenUrl = getTokenUrl(tokenService, domainPrefix);

  var options = {
    url: tokenUrl,
    headers: {
      'Accept': 'application/json'
    },
    form:{
      'grant_type': 'refresh_token',
      'client_id': clientId,
      'client_secret': clientSecret,
      'refresh_token': refreshToken
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
exports.refreshAccessToken = refreshAccessToken;