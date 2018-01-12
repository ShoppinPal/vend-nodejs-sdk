'use strict';

var _ = null;
var moment = null;
var Promise = null;
var request = null;
var log = null;

function RateLimitingError(e) {
  return e.statusCode == 429; // eslint-disable-line eqeqeq
}

function AuthNError(e) {
  return e.statusCode == 401; // eslint-disable-line eqeqeq
}

function ClientError(e) {
  return e.statusCode >= 400 && e.statusCode < 500;
}

function ConnectError(e) { // TODO: maybe leverage https://github.com/petkaantonov/core-error-predicates#connecterror
  return e.code === 'ETIMEDOUT';
}

var successHandler = function(response) {
  if(_.isArray(response)) {
    log.debug('response is an array');
  }
  else if(_.isObject(response)) {
    log.debug('response is an object');
    return Promise.resolve(response);
  }
  else if(_.isString(response)) {
    log.debug('response is a string');
    try{
      var responseObject = JSON.parse(response);
      //log.trace( { message: 'responseObject', data: responseObject } );
      return Promise.resolve(responseObject);
    }
    catch(error){
      log.error('successHandler', 'caught an error: ', error);
      throw error;
    }
  }
  else {
    log.debug(response);
  }
};

var argsAreValid = function(args){
  var arrayOfRequiredArgs = _.filter(args, function(object/*, key*/){
    return object.required;
  });
  var arrayOfRequiredValues = _.pluck(arrayOfRequiredArgs, 'value');
  return !_.contains(arrayOfRequiredValues, undefined);
};

/**
 * If tokenService already has a domainPrefix set because the API consumer passed in a full URL
 * instead of a substitutable one ... then the replace acts as a no-op.
 *
 * @param tokenService
 * @param domain_prefix
 * @returns {*|XML|string|void}
 */
var getTokenUrl = function(tokenService, domainPrefix) {
  var tokenUrl = tokenService.replace(/\{DOMAIN_PREFIX\}/, domainPrefix);
  log.debug('token Url: '+ tokenUrl);
  return tokenUrl;
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
      log.error('A RateLimitingError error like "429 Too Many Requests" happened: '
        + e.statusCode + ' ' + e.response.body + '\n'
        + JSON.stringify(e.response.headers,null,2));
    })
    .catch(ClientError, function(e) {
      log.error('A ClientError happened: '
          + e.statusCode + ' ' + e.response.body + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
         + JSON.stringify(e,null,2)*/
      );
      // TODO: add retry logic
    })
    .catch(function(e) {
      log.error('getInitialAccessToken', 'An unexpected error occurred: ', e);
    });
};

var refreshAccessToken = function(tokenService, clientId, clientSecret, refreshToken, domainPrefix) {
  // TODO: tweak winston logs to prefix method signature (like breadcrumbs) when logging?
  log.debug('refreshAccessToken - token service: ' + tokenService);
  log.debug('refreshAccessToken - client Id: ' + clientId);
  log.debug('refreshAccessToken - client Secret: ' + clientSecret);
  log.debug('refreshAccessToken - refresh token: ' +  refreshToken);
  log.debug('refreshAccessToken - domain prefix: ' + domainPrefix);

  if ( !(tokenService && clientId && clientSecret && refreshToken) ) {
    return Promise.reject('missing required arguments for refreshAccessToken()');
  }

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
      log.error('A RateLimitingError error like "429 Too Many Requests" happened: '
        + e.statusCode + ' ' + e.response.body + '\n'
        + JSON.stringify(e.response.headers,null,2));
    })
    .catch(ClientError, function(e) {
      log.error('A ClientError happened: '
          + e.statusCode + ' ' + e.response.body + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
         + JSON.stringify(e,null,2)*/
      );
      // NOTE: why not throw or retry?
      // sample: "error_description": "The refresh token is invalid."
      // in such a case retrying just doesn't make sense, its better to fail fast
      // which will happen when the methods calling this function try to access its results
    })
    .catch(function(e) {
      log.error('refreshAccessToken', 'An unexpected error occurred: ', e);
    });
};

var retryWhenConnectionFails = function(args, connectionInfo, callback, retryCounter) {
  if(retryCounter<3) {
    var retryAfter = (retryCounter+1)*1000; // will wait for 1, 2, 3 seconds successively
    log.debug('retryWhenConnectionFails', 'retry after: ' + retryAfter + ' ms');

    return Promise.delay(retryAfter)
      .then(function() {
        log.debug('retryWhenConnectionFails', retryAfter + ' ms have passed...');
        return callback(args, connectionInfo, ++retryCounter);
      });
  }
  else {
    return Promise.reject('failed to connect, even after multiple retries');
  }
};

/**
 * TODO: Should we reuse the following library instead of rolling our own implementation here?
 *       https://github.com/you21979/node-limit-request-promise
 *
 * @param bodyObject
 * @param connectionInfo - contains tokens and domainPrefix
 * @param retryCounter
 * @param callback
 * @returns {*|Parse.Promise}
 */
var retryWhenRateLimited = function(bodyObject, args, connectionInfo, callback, retryCounter) {
  if(retryCounter<3) {
    var retryAfter = 5*60*1000; // by default Vend will never block for more than 5 minutes
    retryAfter = Math.max(moment(bodyObject['retry-after']).diff(moment()), 0);
    //retryAfter = 5000; // for sanity testing counter increments quickly
    log.debug('retry after: ' + retryAfter + ' ms');

    return Promise.delay(retryAfter)
      .then(function() {
        log.debug(retryAfter + ' ms have passed...');
        return callback(args, connectionInfo, ++retryCounter);
      });
  }
};

var retryWhenAuthNFails = function(args, connectionInfo, callback, retryCounter) {
  if(retryCounter<3) {
    if ( !(connectionInfo.vendTokenService &&
           connectionInfo.vendClientId &&
           connectionInfo.vendClientSecret &&
           connectionInfo.refreshToken) )
    {
      return Promise.reject('missing required arguments for retryWhenAuthNFails()');
      // throw e; // TODO: throw unknown errors but reject well known errors?
    }

    log.debug('try to fetch a new access token');
    return refreshAccessToken( //TODO: validate connectionInfo before using it for retries?
      connectionInfo.vendTokenService,
      connectionInfo.vendClientId,
      connectionInfo.vendClientSecret,
      connectionInfo.refreshToken,
      connectionInfo.domainPrefix
    )
      .then(function(oauthInfo) {
        log.debug('update connectionInfo w/ new token before using it again');
        var waitFor = Promise.resolve();
        if (oauthInfo.access_token) {
          log.debug('received new access_token');
          connectionInfo.accessToken = oauthInfo.access_token;
          if(_.isFunction(connectionInfo.updateAccessToken)) {
            waitFor = connectionInfo.updateAccessToken(connectionInfo);
          }
        }
        if (oauthInfo.refresh_token) {
          log.debug('received new refresh_token');
          connectionInfo.refreshToken = oauthInfo.refresh_token;
        }

        log.debug('retrying with new accessToken');
        return waitFor.then(function(){
          return callback(args, connectionInfo, ++retryCounter);
        });
      });
  }
};

/**
 * @param expiresAt - time unit from Vend is in unix epoch format
 * @returns {*} true if the the token will be considered as expired in 2 mins from now
 */
var hasAccessTokenExpired = function(expiresAt) {
  return (moment.unix(expiresAt).isBefore(moment().add(2, 'minutes')));
};

var sendRequest = function(options, args, connectionInfo, callback, retryCounter) {
  if ( !(connectionInfo && connectionInfo.accessToken && connectionInfo.domainPrefix) ) {
    return Promise.reject('missing required arguments for sendRequest()');
  }
  if (options.headers) {
    options.headers['User-Agent'] = process.env['User-Agent'] + '.vend-nodejs-sdk';
  }
  return request(options)
    .then(successHandler)
    .catch(ConnectError, function(e) {
      log.error('A ConnectError happened: \n' + e);
      return retryWhenConnectionFails(args, connectionInfo, callback, retryCounter);
      // TODO: how to prevent a throw or rejection from also stepping thru the other catch-blocks?
    })
    .catch(RateLimitingError, function(e) {
      log.error('A RateLimitingError error like "429 Too Many Requests" happened: \n'
        + 'statusCode: ' + e.statusCode + '\n'
        + 'body: ' + e.response.body + '\n'
        //+ JSON.stringify(e.response.headers,null,2)
      );

      var bodyObject = JSON.parse(e.response.body);
      log.debug(bodyObject['retry-after']);
      log.debug(
        moment(bodyObject['retry-after']).format('dddd, MMMM Do YYYY, h:mm:ss a ZZ')
      );
      /*successHandler(e.response.body)
        .then(function(bodyObject){
        log.debug(bodyObject['retry-after']);
        log.debug(
          moment(bodyObject['retry-after']).format('dddd, MMMM Do YYYY, h:mm:ss a ZZ')
        );
        });*/
      return retryWhenRateLimited(bodyObject, args, connectionInfo, callback, retryCounter);
      // TODO: how should a catch-block respond if there is a problem within the retry?
    })
    .catch(AuthNError, function(e) {
      log.error('An AuthNError happened: \n'
        + 'statusCode: ' + e.statusCode + '\n'
        + 'body: ' + e.response.body + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
        + JSON.stringify(e,null,2)*/
      );
      return retryWhenAuthNFails(args, connectionInfo, callback, retryCounter);
      // TODO: how to prevent a throw or rejection from also stepping thru the other catch-blocks?
    })
    .catch(ClientError, function(e) {
      var message = e.response.body;
      if(_.isObject(message)) {
        message = JSON.stringify(message,null,2);
      }
      log.error('A ClientError happened: \n'
        + e.statusCode + ' ' + message + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
        + JSON.stringify(e,null,2)*/
      );

      // TODO: add retry logic

      return Promise.reject(e.statusCode + ' ' + e.response.body); // TODO: throw unknown errors but reject well known errors?
    })
    .catch(function(e) {
      log.error('vend.js - sendRequest - An unexpected error occurred: ', e);
      throw e; // TODO: throw unknown errors but reject well known errors?
    });
};

var processPagesRecursively = function processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, previousProcessedResults){
  return fetchSinglePage(args, connectionInfo)
    .then(function(result){

      // HACK - until Vend responses become consistent
      if (result && result.results && !result.pagination) {
        result.pagination = {
          'results': result.results,
          'page': result.page,
          'page_size': result.page_size,
          'pages': result.pages,
        }; // NOTE: if the first page has all the results, this block won't run then either
      }

      // handle old vend v0.x style of paging
      if(result.pagination && result.pagination.pages > args.page.value) {
        log.info('# of entries returned: ' + result.pagination.results);
        log.info('Page # ' + args.page.value + ' of ' + result.pagination.pages);
        return processPagedResults(result, previousProcessedResults)
          .then(function(newlyProcessedResults){
            args.page.value = args.page.value+1;
            return processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, newlyProcessedResults);
          });
      }
      // handle new vend v2.0 style of paging
      else if (result && result.version && result.data && result.data.length>0) {
        log.info('# of entries returned: ' + result.data.length);
        log.info('version min: '+ result.version.min + ' max: ' + result.version.max);
        if (args.pageSize.value) {
          log.info('Page # ' + args.page.value); // page has no operational role here, just useful for readable logs
        }
        return processPagedResults(result, previousProcessedResults)
          .then(function(newlyProcessedResults){
            args.after.value = result.version.max; // work on whatever is left after the max version from previous call
            args.page.value = args.page.value+1; // page has no operational role here, just useful for readable logs
            return processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, newlyProcessedResults);
          });
      }
      else {
        log.info('Processing last page. Page # ' + args.page.value);
        return processPagedResults(result, previousProcessedResults);
      }
    });
};

var processPromisesSerially = function(aArray, aArrayIndex, args, mergeStrategy, setupNext, executeNext, aPreviousResults){
  if (aArrayIndex < aArray.length) {
    log.debug('processPromisesSerially for aArrayIndex # ' + aArrayIndex);
    return executeNext(args)
      .then(function(executedResults){
        //log.trace( { message: 'executedResults', data: executedResults } );
        //log.trace('executedResults.length ' + executedResults.length); // .length may not be valid everytime
        return mergeStrategy(executedResults, aPreviousResults, args)
          .then(function(mergedResults){
            log.debug('mergedResults.length ' + mergedResults.length);
            //log.trace( { message: 'before', data: args } );
            args = setupNext(args);
            //log.trace( { message: 'after', data: args } );
            return processPromisesSerially(
              args.getArray(), //args.consignmentIds.value,
              args.getArrayIndex(), //args.consignmentIdIndex.value,
              args,
              mergeStrategy,
              setupNext,
              executeNext,
              mergedResults
            );
          });
      });
  }
  else {
    if(aPreviousResults) {
      log.debug('aPreviousResults.length ' + aPreviousResults.length);
    }
    log.debug('processPromisesSerially() finished');
    return Promise.resolve(aPreviousResults);
  }
};

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore;
  moment = dependencies.moment;
  Promise = dependencies.bluebird;
  request = dependencies['request-promise'];
  log = dependencies.logger;

  // (2) initialize any module-scoped variables which need the dependencies
  // ...

  // (3) expose the SDK
  return {
    argsAreValid: argsAreValid,
    sendRequest: sendRequest,
    hasAccessTokenExpired: hasAccessTokenExpired,
    getInitialAccessToken: getInitialAccessToken,
    refreshAccessToken: refreshAccessToken,
    processPagesRecursively: processPagesRecursively,
    processPromisesSerially: processPromisesSerially
  };
};
