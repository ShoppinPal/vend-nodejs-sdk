'use strict';

var _ = require('underscore');
var moment = require('moment');
var Promise = require('bluebird');

var request = require('request-promise');
//request.debug = true;

var log = require('winston');
log.remove(log.transports.Console);
log.add(log.transports.Console, {colorize: true, timestamp: false, level: 'debug'});

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

/**
 * TODO: Should we reuse the following library instead of rolling our own implementation here?
 *       https://github.com/you21979/node-limit-request-promise
 *
 * @param bodyObject
 * @param domainPrefix
 * @param accessToken
 * @param retryCounter
 * @param callback
 * @returns {*|Parse.Promise}
 */
var retry = function(bodyObject, domainPrefix, accessToken, retryCounter, callback) {
  if(retryCounter<3) {
    var retryAfter = 5*60*1000; // by default Vend will never block for more than 5 minutes
    retryAfter = Math.max(moment(bodyObject['retry-after']).diff(moment()), 0);
    //retryAfter = 5000; // for sanity testing counter increments quickly
    console.log('retry after: ' + retryAfter + ' ms');

    return Promise.delay(retryAfter)
      .then(function() {
        console.log(retryAfter + ' ms have passed...');
        return callback(domainPrefix, accessToken, ++retryCounter);
      });
  }
};

var getTokenUrl = function(tokenService, domain_prefix) {
  var tokenUrl = tokenService.replace(/\{DOMAIN_PREFIX\}/, domain_prefix);
  log.debug('token Url: '+ tokenUrl);
  return tokenUrl;
};

var fetchProducts = function(domainPrefix, accessToken, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

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
      console.log('A RateLimitingError error like "429 Too Many Requests" happened: \n'
        + 'statusCode: ' + e.statusCode + '\n'
        + 'body: ' + e.response.body + '\n'
        //+ JSON.stringify(e.response.headers,null,2)
      );

      var bodyObject = JSON.parse(e.response.body);
      console.log(bodyObject['retry-after']);
      console.log(
        moment(bodyObject['retry-after']).format('dddd, MMMM Do YYYY, h:mm:ss a ZZ')
      );
      /*successHandler(e.response.body)
        .then(function(bodyObject){
          console.log(bodyObject['retry-after']);
          console.log(
            moment(bodyObject['retry-after']).format('dddd, MMMM Do YYYY, h:mm:ss a ZZ')
          );
        });*/
      return retry(bodyObject, domainPrefix, accessToken, retryCounter, fetchProducts);
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

/**
 * @param expiresAt - time unit from Vend is in unix epoch format
 * @returns {*} true if the the token will be considered as expired in 2 mins from now
 */
var hasAccessTokenExpired = function(expiresAt) {
  return (moment.unix(expiresAt).isBefore(moment().add(2, 'minutes')));
};

exports.hasAccessTokenExpired = hasAccessTokenExpired;
exports.fetchProducts = fetchProducts;
exports.getInitialAccessToken = getInitialAccessToken;
exports.refreshAccessToken = refreshAccessToken;