'use strict';

var _ = null;
var moment = null;
var Promise = null;
var request = null;
var log = null;

/* jshint ignore:start */
function RateLimitingError(e) {
  return e.statusCode == 429;
}

function AuthNError(e) {
  return e.statusCode == 401;
}

function AuthZError(e) {
  return e.statusCode == 403;
}

function ClientError(e) {
  return e.statusCode >= 400 && e.statusCode < 500;
}
/* jshint ignore:end */

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
      //log.silly(responseObject);
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
      .then(function(oauthInfo) {/*jshint camelcase: false */
        log.debug('update connectionInfo w/ new token before using it again', oauthInfo);
        var waitFor = Promise.resolve();
        if (oauthInfo.access_token) {
          log.debug('received new access_token: ' + oauthInfo.access_token);
          connectionInfo.accessToken = oauthInfo.access_token;
          if(_.isFunction(connectionInfo.updateAccessToken)) {
            waitFor = connectionInfo.updateAccessToken(connectionInfo);
          }
        }
        if (oauthInfo.refresh_token) {
          log.debug('received new refresh_token: ' + oauthInfo.refresh_token);
          connectionInfo.refreshToken = oauthInfo.refresh_token;
        }

        log.debug('retrying with new accessToken: ' + connectionInfo.accessToken);
        return waitFor.then(function(){
          return callback(args, connectionInfo, ++retryCounter);
        });
      });
  }
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
    .catch(RateLimitingError, function(e) {// jshint ignore:line
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
    .catch(AuthNError, function(e) {// jshint ignore:line
      log.error('An AuthNError happened: \n'
          + 'statusCode: ' + e.statusCode + '\n'
          + 'body: ' + e.response.body + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
         + JSON.stringify(e,null,2)*/
      );
      return retryWhenAuthNFails(args, connectionInfo, callback, retryCounter);
      // TODO: how to prevent a throw or rejection from also stepping thru the other catch-blocks?
    })
    .catch(ClientError, function(e) {// jshint ignore:line
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

function processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, previousProcessedResults){
  return fetchSinglePage(args, connectionInfo)
    .then(function(result){/*jshint camelcase: false */

      // HACK - until Vend responses become consistent
      if (result && result.results && !result.pagination) {
        result.pagination = {
          'results': result.results,
          'page': result.page,
          'page_size': result.page_size,
          'pages': result.pages,
        }; // NOTE: if the first page has all the results, this block won't run then either
      }

      if(result.pagination && result.pagination.pages > args.page.value) {
        log.info('# of entries returned: ' + result.pagination.results);
        log.info('Page # ' + args.page.value + ' of ' + result.pagination.pages);
        return processPagedResults(result, previousProcessedResults)
          .then(function(newlyProcessedResults){
            args.page.value = args.page.value+1;
            return processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, newlyProcessedResults);
          });
      }
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
}

var processPromisesSerially = function(aArray, aArrayIndex, args, mergeStrategy, setupNext, executeNext, aPreviousResults){
  if (aArrayIndex < aArray.length) {
    log.debug('processPromisesSerially for aArrayIndex # ' + aArrayIndex);
    return executeNext(args)
      .then(function(executedResults){
        //log.silly('executedResults ', executedResults);
        //log.silly('executedResults.length ', executedResults.length); // .length may not be valid everytime
        return mergeStrategy(executedResults, aPreviousResults, args)
          .then(function(mergedResults){
            log.debug('mergedResults.length ', mergedResults.length);
            //log.silly('before: ', args);
            args = setupNext(args);
            //log.silly('after: ', args);
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
    log.debug('aPreviousResults.length ', aPreviousResults.length);
    }
    log.debug('processPromisesSerially() finished');
    return Promise.resolve(aPreviousResults);
  }
};

var argsAreValid = function(args){
  var arrayOfRequiredArgs = _.filter(args, function(object/*, key*/){
    return object.required;
  });
  var arrayOfRequiredValues = _.pluck(arrayOfRequiredArgs, 'value');
  return !_.contains(arrayOfRequiredValues, undefined);
};

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
  consignments: {
    fetchById: function() {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    },
    products: {
      create: function() {
        return {
          consignmentId: {
            required: true,
            key: 'consignment_id',
            value: undefined
          },
          productId: {
            required: true,
            key: 'product_id',
            value: undefined
          },
          count: {
            required: true,
            key: 'count',
            value: undefined
          },
          cost: {
            required: true,
            key: 'cost',
            value: undefined
          },
          sequenceNumber: {
            required: false,
            key: 'sequence_number',
            value: undefined
          },
          received: {
            required: false,
            key: 'received',
            value: undefined
          }
        };
      },
      update: function() {
        return {
          apiId: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          },
          body: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          }
        };
      },
      remove: function() {
        return {
          apiId: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          }
        };
      },
      fetchAllByConsignment: function() {
        return {
          consignmentId: {
            required: true,
            key: 'consignment_id',
            value: undefined
          },
          page: {
            required: false,
            key: 'page',
            value: undefined
          },
          pageSize: {
            required: false,
            key: 'page_size',
            value: undefined
          }
        };
      }
    },
    stockOrders: {
      create: function() {
        return {
          name: {
            required: true,
            key: 'name',
            value: undefined
          },
          outletId: {
            required: true,
            key: 'outlet_id',
            value: undefined
          },
          supplierId: {
            required: true, // can be null according to Vend, but we decided to make it mandatory, hmmm...
            key: 'supplier_id',
            value: undefined
          },
          dueAt: {
            required: false, // can be null, ok by Vend
            key: 'due_at',
            value: undefined
          }
        };
      },
      markAsSent: function() {
        return {
          apiId: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          },
          body: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          }
        };
      },
      markAsReceived: function() {
        return {
          apiId: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          },
          body: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          }
        };
      },
      remove: function() {
        return {
          apiId: {
            required: true,
            //id: undefined, // does not travel as a key/value property in the JSON payload
            value: undefined
          }
        };
      }
    }
  },
  products: {
    fetchById: function() {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    },
    update: function() {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    },
    create: function() {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    },
    uploadImage: function() {
      return {
        apiId: {
          required: true,
          value: undefined
        },
        image: {
          required: true,
          value: undefined
        }
      };
    },
    fetch: function() {
      return {
        orderBy: {
          required: false,
          key: 'order_by',
          value: undefined // updated_at (default) | id | name
        },
        orderDirection: {
          required: false,
          key: 'order_direction',
          value: undefined // ASC (default) | DESC
          //TODO: setup enumerations in javascript?
        },
        since: {
          required: false,
          key: 'since',
          value: undefined
        },
        active: {
          required: false,
          key: 'active',
          value: undefined // 0 (or no value) : returns only inactive products
                           // 1 (or any other value) : returns only active products
          // TODO: can we embed a transformation here?
          //       API consumer will set true or false or 0 or 1 as the value
          //       but SDK will get the 0 or 1 value based on a transformation
        },
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    }
  },
  customers: {
    fetch: function() {
      return {
        apiId: {
          required: false,
          key: 'id', // TODO: enforce rule: cannot be used with the code or email options.
          value: undefined
        },
        code: {
          required: false,
          key: 'code', // TODO: enforce rule: cannot be used with id or email options.
          value: undefined // ASC (default) | DESC
          //TODO: setup enumerations in javascript?
        },
        email: {
          required: false,
          key: 'email', // TODO: enforce rule: cannot be used with the id or code options.
          value: undefined
        },
        since: {
          required: false,
          key: 'since',
          value: undefined // should be in UTC and formatted according to ISO 8601
        }
      };
    }
  },
  registers: {
    fetchById: function() {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    },
    fetch: function() {
      return {
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    }
  },
  outlets: {
    fetch: function() {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined
        },
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    fetchById: function() {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    }
  },
  paymentTypes: {
    fetch: function() {
      return {
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    }
  },
  productTypes: {
    fetch: function() {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined
        },
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    create: function () {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    }
  },
  taxes: {
    fetch: function() {
      return {
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    create: function () {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    }
  },
  brands: {
    fetch: function() {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined
        },
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    create: function () {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    }
  },
  tags: {
    fetch: function() {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined
        },
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    create: function () {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    }
  },
  sales: {
    fetch: function() {
      return {
        since: {
          deprecated: true,
          notes: 'Deprecated since version 1.0: ' +
            'If you need to be notified of register sales, ' +
            'and modifications to register sales, ' +
            'use a register_sale.update webhook instead.\n' +
            '' +
            'http://support.vendhq.com/hc/en-us/requests/32281\n' +
            '' +
            'The deprecation notice was added by one of our sysadmins trying to reduce database load. ' +
            'Feel free to ignore this deprecation and I\'ll remove it.\n' +
            'We will eventually be deprecating a time-based "since" ' +
            'but not until we replace it with real alternative ' +
            '(likely to be some sort of incrementing integer value ' +
            '- so same effect, but nicer on the database).\n' +
            'Thanks,\n' +
            'Keri Henare\n' +
            'Senior Developer Evangelist @ Vend',
          required: false,
          key: 'since',
          value: undefined
        },
        outletApiId: {
          required: false,
          key: 'outlet_id',
          value: undefined // returns only register sales made for the given outlet
        },
        tag: {
          required: false,
          key: 'tag',
          value: undefined
        },
        // TODO: docs are a bit odd, don't want to introduce this until docs make sense
        /*status: {
          required: false,
          key: 'status[]',
          value: undefined
        },*/
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    }
  },
  suppliers: {
    fetchAll: function() {
      return {
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
    create: function () {
      return {
        body: {
          required: true,
          value: undefined
        }
      };
    }
  }
};

var fetchStockOrdersForSuppliers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchStockOrderForSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {/*jshint camelcase: false */
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchStockOrdersForSuppliers, retryCounter);
};

var fetchAllStockOrdersForSuppliers = function(connectionInfo, processPagedResults) {
  var args = {
    page: {value: 1},//{value: 25},
    pageSize: {value: 200}
  };
  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function(pagedData, previousData){
      if (previousData && previousData.length>0) {
        if (pagedData.consignments.length>0) {
        log.debug('previousData: ', previousData.length);
        pagedData.consignments = pagedData.consignments.concat(previousData);
        log.debug('combined: ', pagedData.consignments.length);
      }
        else {
          pagedData.consignments = previousData;
        }
      }
      return Promise.resolve(pagedData.consignments);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchStockOrdersForSuppliers, processPagedResults);
};

var fetchProductsByConsignment  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment_product';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {/*jshint camelcase: false */
      consignment_id: args.consignmentId.value,
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProductsByConsignment, retryCounter);
};

var defaultMethod_ForProcessingPagedResults_ForConsignmentProducts = function(pagedData, previousData){// jshint ignore:line
  /*jshint camelcase: false */
  log.debug('defaultMethod_ForProcessingPagedResults_ForConsignmentProducts');
  if (previousData && previousData.length>0) {
    //log.verbose(JSON.stringify(pagedData.consignment_products,replacer,2));
    if (pagedData.consignment_products && pagedData.consignment_products.length>0) {
      log.debug('previousData: ', previousData.length);
        pagedData.consignment_products = pagedData.consignment_products.concat(previousData);
      log.debug('combined: ', pagedData.consignment_products.length);
      }
    else {
      pagedData.consignment_products = previousData;
    }
  }
  //log.silly('finalData: ', pagedData.consignment_products);
  log.debug('finalData.length: ', pagedData.consignment_products.length);
      return Promise.resolve(pagedData.consignment_products);
};

var defaultMethod_ForProcessingPagedResults_ForSuppliers = function processPagedResults(pagedData, previousData){// jshint ignore:line
  log.debug('defaultMethod_ForProcessingPagedResults_ForSuppliers');
  if (previousData && previousData.length>0) {
    //log.verbose(JSON.stringify(pagedData.suppliers,replacer,2));
    if (pagedData.suppliers && pagedData.suppliers.length>0) {
      log.debug('previousData: ', previousData.length);
      pagedData.suppliers = pagedData.suppliers.concat(previousData);
      log.debug('combined: ', pagedData.suppliers.length);
    }
    else {
      pagedData.suppliers = previousData;
    }
  }
  return Promise.resolve(pagedData.suppliers);
};

var fetchAllProductsByConsignment = function(args, connectionInfo, processPagedResults) {
  args.page = {value: 1};
  args.pageSize = {value: 200};
  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForConsignmentProducts;// jshint ignore:line
  }
  return processPagesRecursively(args, connectionInfo, fetchProductsByConsignment, processPagedResults);
};

var fetchAllProductsByConsignments = function(args, connectionInfo, processPagedResults) {
  // args.consignmentIds.value MUST already be set
  args.page = {value: 1};
  args.pageSize = {value: 200};
  args.consignmentIdIndex = {value: 0};
  args.consignmentId = {value: args.consignmentIds.value[args.consignmentIdIndex.value]};
  args.getArray = function(){
    return this.consignmentIds.value;
  };
  args.getArrayIndex = function(){
    return this.consignmentIdIndex.value;
  };

  // iterate serially through a promise chain for all args.consignmentIds.value
  return processPromisesSerially(
    args.consignmentIds.value,
    args.consignmentIdIndex.value,
    args,
    function mergeStrategy(newData, previousData){
      log.debug('inside mergeStrategy()');
      //log.silly('newData ', newData);
      //log.silly('previousData ', previousData);
      if (previousData && previousData.length>0) {
        if (newData.length>0) {
        log.debug('previousData.length: ', previousData.length);
        newData = newData.concat(previousData);
        log.debug('combinedData.length: ', newData.length);
      }
        else {
          newData = previousData;
        }
      }
      //log.silly('finalData ', newData);
      log.debug('finalData.length ', newData.length);
      return Promise.resolve(newData); // why do we need a promise?
    },
    function setupNext(updateArgs){
      updateArgs.consignmentIdIndex.value = updateArgs.consignmentIdIndex.value + 1;
      if (updateArgs.consignmentIdIndex.value < updateArgs.consignmentIds.value.length) {
        updateArgs.consignmentId.value = updateArgs.consignmentIds.value[updateArgs.consignmentIdIndex.value];
        log.debug('next is consignmentId: ' + updateArgs.consignmentId.value);
      }
      else {
        updateArgs.consignmentId.value = null;
        log.debug('finished iterating through all the consignmentIds');
      }
      return updateArgs;
    },
    function executeNext(updatedArgs){
      log.debug('executing for consignmentId: ' + updatedArgs.consignmentId.value);
      //log.silly('updatedArgs: ', updatedArgs);
      return fetchAllProductsByConsignment(updatedArgs, connectionInfo, processPagedResults);
    }
  );
};

var resolveMissingSuppliers = function(args, connectionInfo) {
  // args.consignmentIdToProductIdMap.value MUST already be set by the caller
  // args.consignmentProductId.value MUST be set for the very first call
  args.arrayIndex = {value: 0};
  args.consignmentProductId = {value: args.consignmentIdToProductIdMap.value[args.arrayIndex.value].productId};
  args.getArray = function(){
    return this.consignmentIdToProductIdMap.value;
  };
  args.getArrayIndex = function(){
    return this.arrayIndex.value;
  };

  // iterate serially through a promise chain for all args.consignmentIds.value
  return processPromisesSerially(
    args.getArray(),
    args.getArrayIndex(),
    args,
    function mergeStrategy(newData, previousData, args){/*jshint camelcase: false */
      log.debug('resolveMissingSuppliers - inside mergeStrategy()');
      var product = newData.products[0];
      //log.silly('newData: ', newData);
      //log.silly('product: ', product);
      var updateMe = args.getArray()[args.getArrayIndex()];
      updateMe.supplier = product.supplier_name || product.supplier_code;
      log.debug('updated consignmentIdToProductIdMap: ', args.getArray()[args.getArrayIndex()]);

      previousData = args.getArray();
      return Promise.resolve(previousData); // why do we need a promise?
    },
    function setupNext(updateArgs){
      log.debug('resolveMissingSuppliers - inside setupNext()');
      updateArgs.arrayIndex.value = updateArgs.getArrayIndex() + 1;
      if (updateArgs.getArrayIndex() < updateArgs.getArray().length) {
        updateArgs.consignmentProductId.value = updateArgs.getArray()[updateArgs.getArrayIndex()].productId;
        log.debug('resolveMissingSuppliers - next is consignmentId: ' + updateArgs.consignmentProductId.value);
      }
      else {
        updateArgs.consignmentProductId.value = null;
        log.debug('resolveMissingSuppliers - finished iterating through all the consignmentIds');
      }
      return updateArgs;
    },
    function executeNext(updatedArgs){
      log.debug('resolveMissingSuppliers - inside executeNext()');
      log.debug('resolveMissingSuppliers - executing for consignmentProductId: ' + updatedArgs.consignmentProductId.value);
      //log.silly('updatedArgs: ', updatedArgs);
      var args = argsForInput.products.fetchById();
      args.apiId.value = updatedArgs.consignmentProductId.value;
      return fetchProduct(args, connectionInfo);
    }
  );
};

// WARN: if the ID is incorrect, the vend api the first 50 products which can totally throw folks off their mark!
// TODO: instead of returning response, return the value of response.products[0] directly?
var fetchProduct = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products/' + args.apiId.value;
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProduct, retryCounter);
};

/**
 * This method updates a product by product Id.
 * The product's id is passed in the `body` as a json object along with other parameters
 * instead of passing it in the url as querystring. That's how an update happens in Vend.
 */
var updateProductById = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for updateProductById()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, updateProductById, retryCounter);
};


var deleteProductById = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteProductById()');

  log.debug(args);
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for deleteProductById()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  log.debug('args.apiId.value: ' + args.apiId.value);
  var path = '/api/products/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'DELETE',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, deleteProductById, retryCounter);
};

var createProduct = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createProduct()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  console.log('body', body);
  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createProduct, retryCounter);
};

var uploadProductImage = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for uploadProductImage()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/products/' + args.apiId.value + '/actions/image_upload';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.image.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, uploadProductImage, retryCounter);
};

// TODO: instead of returning response, return the value of response.products[0] directly?
var fetchProductByHandle  = function(args, connectionInfo, retryCounter) {
  if ( !(args && args.handle && args.handle.value) ) {
    return Promise.reject('missing required arguments for fetchProductByHandle()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products';
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      handle: args.handle.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProductByHandle, retryCounter);
};

// TODO: instead of returning response, return the value of response.products[0] directly?
var fetchProductBySku  = function(args, connectionInfo, retryCounter) {
  if ( !(args && args.sku && args.sku.value) ) {
    return Promise.reject('missing required arguments for fetchProductByHandle()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products';
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      sku: args.sku.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProductBySku, retryCounter);
};

var fetchProducts = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/products';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  //var domainPrefix = this.domainPrefix;

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {/*jshint camelcase: false */
      order_by: args.orderBy.value,
      order_direction: args.orderDirection.value,
      since: args.since.value,
      active: (args.active.value) ? 1 : 0,
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };
  if (args.page.value) {
    log.debug('Requesting product page ' + args.page.value);
  }

  return sendRequest(options, args, connectionInfo, fetchProducts, retryCounter);
};

var fetchAllProducts = function(connectionInfo, processPagedResults) {
  var args = argsForInput.products.fetch();
  args.orderBy.value = 'id';
  args.page.value = 1;
  args.pageSize.value = 200;
  args.active.value = true;

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllProducts - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.products,replacer,2));
        if (pagedData.products && pagedData.products.length>0) {
          log.debug('previousData: ', previousData.length);
          pagedData.products = pagedData.products.concat(previousData);
          log.debug('combined: ', pagedData.products.length);
        }
        else {
          pagedData.products = previousData;
        }
      }
      return Promise.resolve(pagedData.products);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchProducts, processPagedResults);
};

var fetchPaginationInfo = function(args, connectionInfo){
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchPaginationInfo()');
  }
  return fetchProducts(args, connectionInfo)
    .then(function(result){/*jshint camelcase: false */

      // HACK - until Vend responses become consistent
      if (result && result.results && !result.pagination) {
        result.pagination = {
          'results': result.results,
          'page': result.page,
          'page_size': result.page_size,
          'pages': result.pages,
        }; // NOTE: if the first page has all the results, this block won't run then either
      }

      return (result && result.pagination) ? Promise.resolve(result.pagination) : Promise.resolve();
    });
};

var fetchCustomers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      id: args.apiId.value,
      code: args.code.value,
      email: args.email.value, // TODO: does this need to be explicitly url-encoded? or is it taken care of automagically?
      since: args.since.value
    } //TODO: add page & page_size?
  };

  return sendRequest(options, args, connectionInfo, fetchCustomers, retryCounter);
};

var fetchCustomerByEmail = function(email, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomerByEmail()');
  var args = args.customers.fetch();
  args.email.value = email;
  fetchCustomers(args, connectionInfo, retryCounter);
};

var fetchRegisters = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchRegisters()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/registers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {/*jshint camelcase: false */
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchRegisters, retryCounter);
};

var fetchAllRegisters = function(args, connectionInfo, processPagedResults) {
  if (!args) {
    args = argsForInput.registers.fetch();
  }
  args.page = {value:1};
  args.pageSize = {value:200};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllRegisters - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.products,replacer,2));
        if (pagedData.registers && pagedData.registers.length>0) {
          log.debug('previousData: ', previousData.length);
          pagedData.registers = pagedData.registers.concat(previousData);
          log.debug('combined: ', pagedData.registers.length);
        }
        else {
          pagedData.registers = previousData;
        }
      }
      return Promise.resolve(pagedData.registers);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchRegisters, processPagedResults);
};

var fetchRegister  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/registers/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchRegister, retryCounter);
};

var fetchPaymentTypes = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchPaymentTypes()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/payment_types';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchPaymentTypes, retryCounter);
};

var fetchProductTypes = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchProductTypes()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/product_types';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
    // WARN: 2.0 uses `after` and even though `page_size` is not documented, it is still useable.
    //       Server side no longer limits you to pages of size 200 and it can handle north of 10000 easy
    qs: { /*jshint camelcase: false */
      after: args.after.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProductTypes, retryCounter);
};

var createProductTypes = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createProductTypes()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/product_types';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createProductTypes, retryCounter);
};

var fetchTaxes = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchTaxes()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/taxes';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchTaxes, retryCounter);
};

var createTax = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createTax()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/taxes';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createTax, retryCounter);
};

var fetchBrands = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchBrands()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/brands';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
    // WARN: 2.0 uses `after` and even though `page_size` is not documented, it is still useable.
    //       Server side no longer limits you to pages of size 200 and it can handle north of 10000 easy
    qs: { /*jshint camelcase: false */
      after: args.after.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchBrands, retryCounter);
};

var createBrand = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createBrand()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/brands';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createBrand, retryCounter);
};

var fetchTags = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchTags()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/tags';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
    // WARN: 2.0 uses `after` and even though `page_size` is not documented, it is still useable.
    //       Server side no longer limits you to pages of size 200 and it can handle north of 10000 easy
    qs: { /*jshint camelcase: false */
      after: args.after.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchTags, retryCounter);
};

var fetchAllTags = function(args, connectionInfo, processPagedResults) {
  log.debug('inside fetchAllTags()');
  if (!args) {
    args = argsForInput.tags.fetch();
  }
  if (!args.after || !args.after.value) {
    args.after = {value:0};
  }
  if (!args.page || !args.page.value) {
    args.page = {value:1}; // page has no operational role here, just useful for readable logs
  }
  if (!args.pageSize || !args.pageSize.value) {
    args.pageSize = {value:200};
  }

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllTags - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.data,replacer,2));
        if (pagedData.data && pagedData.data.length>0) {
          log.debug('previousData: ', previousData.length);
          pagedData.data = pagedData.data.concat(previousData);
          log.debug('combined: ', pagedData.data.length);
        }
        else {
          pagedData.data = previousData;
        }
      }
      return Promise.resolve(pagedData.data);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchTags, processPagedResults);
};

var createTag = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createTag()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/tags';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createTag, retryCounter);
};

var fetchRegisterSales = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchRegisterSales()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {/*jshint camelcase: false */
      since: args.since.value,
      outlet_id: args.outletApiId.value,
      tag: args.tag.value,
      // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchRegisterSales, retryCounter);
};

var fetchAllRegisterSales = function(args, connectionInfo, processPagedResults) {
  if (!args) {
    args = argsForInput.sales.fetch();
  }
  args.page = {value:1};
  args.pageSize = {value:200};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){/*jshint camelcase: false */
      log.debug('fetchAllRegisterSales - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.products,replacer,2));
        if (pagedData.register_sales && pagedData.register_sales.length>0) {
          log.debug('previousData: ', previousData.length);
          pagedData.register_sales = pagedData.register_sales.concat(previousData);
          log.debug('combined: ', pagedData.register_sales.length);
        }
        else {
          pagedData.register_sales = previousData;
        }
      }
      return Promise.resolve(pagedData.register_sales);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchRegisterSales, processPagedResults);
};

var fetchOutlets = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchOutlets()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/outlets';
  if (args.path && args.path.value) {
    path = args.path.value;
  }
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
    // WARN: 2.0 uses `after` and even though `page_size` is not documented, it is still useable.
    //       Server side no longer limits you to pages of size 200 and it can handle north of 10000 easy
    qs: { /*jshint camelcase: false */
      after: args.after.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchOutlets, retryCounter);
};

var fetchAllOutlets = function(args, connectionInfo, processPagedResults) {
  log.debug('inside fetchAllOutlets()');
  if (!args) {
    args = argsForInput.outlets.fetch();
  }
  if (!args.after || !args.after.value) {
    args.after = {value:0};
  }
  if (!args.page || !args.page.value) {
    args.page = {value:1}; // page has no operational role here, just useful for readable logs
  }
  if (!args.pageSize || !args.pageSize.value) {
    args.pageSize = {value:200};
  }
  args.path = {value:'/api/2.0/outlets'};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllOutlets - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.data,replacer,2));
        if (pagedData.data && pagedData.data.length>0) {
          log.debug('previousData: ', previousData.length);
          pagedData.data = pagedData.data.concat(previousData);
          log.debug('combined: ', pagedData.data.length);
        }
        else {
          pagedData.data = previousData;
        }
      }
      return Promise.resolve(pagedData.data);
    };
  }
  return processPagesRecursively(args, connectionInfo, fetchOutlets, processPagedResults);
};

var fetchOutlet = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/outlets/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend outlet ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchOutlet, retryCounter);
};

var fetchSupplier = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/supplier/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchSupplier, retryCounter);
};

var fetchSuppliers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/supplier';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };
  if (args.page && args.pageSize){
    // NOTE: page and page_size work! For ex: page=1,page_size=1 return just one result in response.suppliers
    options.qs = {/*jshint camelcase: false */
      page: args.page.value,
      page_size: args.pageSize.value
    };
    log.debug(options);
    // NOTE: BUT for this endpoint, the paging properties in the response are part of the immediate response,
    //       instead of being nested one-level-down under the response.pagination structure!
  }

  return sendRequest(options, args, connectionInfo, fetchSuppliers, retryCounter);
};

var fetchAllSuppliers = function(connectionInfo, processPagedResults) {
  var args = argsForInput.suppliers.fetchAll();
  args.page.value = 1;
  args.pageSize.value = 200;

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForSuppliers;// jshint ignore:line
  }
  return processPagesRecursively(args, connectionInfo, fetchSuppliers, processPagedResults);
};

var createSupplier = function(args, connectionInfo, retryCounter) {
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createSupplier()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/supplier';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createSupplier, retryCounter);
};

var fetchConsignment  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/1.0/consignment/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend consignment ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchConsignment, retryCounter);
};

var createConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside createConsignmentProduct()');

  var body = null;
  if (args && args.body) {
    body = args.body;
  }
  else {
    if ( !(args && argsAreValid(args)) ) {
      return Promise.reject('missing required arguments for createConsignmentProduct()');
    }
    body = {
      'consignment_id': args.consignmentId.value,
      'product_id': args.productId.value,
      'count': args.count.value,
      'cost': args.cost.value,
      'sequence_number': args.sequenceNumber.value,
      'received': args.received.value,
    };
  }


  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment_product';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createConsignmentProduct, retryCounter);
};

var createStockOrder = function(args, connectionInfo, retryCounter) {
  log.debug('inside createStockOrder()');

  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createStockOrder()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var body = {
    'type': 'SUPPLIER',
    'status': 'OPEN',
    'name': args.name.value,
    'date': moment().format('YYYY-MM-DD HH:mm:ss'), //'2010-01-01 14:01:01',
    'due_at': args.dueAt.value,
    'outlet_id': args.outletId.value,
    'supplier_id': args.supplierId.value
  };
  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, createStockOrder, retryCounter);
};

var createCustomer = function(body, connectionInfo, retryCounter) {
  log.debug('inside createCustomer()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, body, connectionInfo, createCustomer, retryCounter);
};

var createRegisterSale = function(body, connectionInfo, retryCounter) {
  log.debug('inside createRegisterSale()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  try {
    body = _.isObject(body) ? body : JSON.parse(body);
  }
  catch(exception) {
    log.error('createRegisterSale', exception);
    return Promise.reject('inside createRegisterSale() - failed to parse the sale body');
  }

  var options = {
    method: 'POST',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, body, connectionInfo, createRegisterSale, retryCounter);
};

var updateConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside updateConsignmentProduct()', args);

  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for updateConsignmentProduct()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment_product/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;

  var options = {
    method: 'PUT',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method, options.url);
  log.debug('body:', options.json);

  return sendRequest(options, args, connectionInfo, updateConsignmentProduct, retryCounter);
};

var markStockOrderAsSent = function(args, connectionInfo, retryCounter) {
  log.debug('inside markStockOrderAsSent()', args);

  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for markStockOrderAsSent()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;
  body.status = 'SENT';

  var options = {
    method: 'PUT',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method, options.url);
  log.debug('body:', options.json);

  return sendRequest(options, args, connectionInfo, markStockOrderAsSent, retryCounter);
};

var markStockOrderAsReceived = function(args, connectionInfo, retryCounter) {
  log.debug('inside markStockOrderAsReceived()', args);

  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for markStockOrderAsReceived()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/consignment/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?
  var body = args.body.value;
  body.status = 'RECEIVED';

  var options = {
    method: 'PUT',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: body
  };
  log.debug(options.method, options.url);
  log.debug('body:', options.json);

  return sendRequest(options, args, connectionInfo, markStockOrderAsReceived, retryCounter);
};

var deleteStockOrder = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteStockOrder()');

  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for deleteStockOrder()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  log.debug(args.apiId.value);
  var path = '/api/consignment/' + args.apiId.value;
  log.debug(path);
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'DELETE',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, deleteStockOrder, retryCounter);
};

var deleteConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteConsignmentProduct()');

  log.debug(args);
  if ( !(args && argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for deleteStockOrder()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  log.debug('args.apiId.value: ' + args.apiId.value);
  var path = '/api/consignment_product/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.silly('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'DELETE',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  log.debug(options.method + ' ' + options.url);

  return sendRequest(options, args, connectionInfo, deleteConsignmentProduct, retryCounter);
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
    .catch(RateLimitingError, function(e) {// jshint ignore:line
      log.error('A RateLimitingError error like "429 Too Many Requests" happened: '
        + e.statusCode + ' ' + e.response.body + '\n'
        + JSON.stringify(e.response.headers,null,2));
    })
    .catch(ClientError, function(e) {// jshint ignore:line
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
    .catch(RateLimitingError, function(e) {// jshint ignore:line
      log.error('A RateLimitingError error like "429 Too Many Requests" happened: '
        + e.statusCode + ' ' + e.response.body + '\n'
        + JSON.stringify(e.response.headers,null,2));
    })
    .catch(ClientError, function(e) {// jshint ignore:line
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

/**
 * @param expiresAt - time unit from Vend is in unix epoch format
 * @returns {*} true if the the token will be considered as expired in 2 mins from now
 */
var hasAccessTokenExpired = function(expiresAt) {
  return (moment.unix(expiresAt).isBefore(moment().add(2, 'minutes')));
};

var replacer = function(key, value) {
  if(value !== undefined  && value !== null) {
    if(typeof value === 'string') {
      if(value.trim().length>0) {
        return value;
      }
      else {
        return undefined;
      }
    }
    return value;
  }
  return undefined; // returning this removes properties
};

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore || require('underscore');
  moment = dependencies.moment || require('moment');
  Promise = dependencies.bluebird || require('bluebird');

  request = dependencies['request-promise'] || require('request-promise');
  request.debug = dependencies.debugRequests;

  /**
   * Using winston can SUCK because it formats and positions things differently
   * than what we are used to with console.log()
   * > for ex: 1. json data is not made part of the message
   * >         2. arrays are formatted and printed in a fashion that
   * >            will make you think that you have the wrong data structure!
   * >         3. prettyPrint option doesn't work for file logging
   * >         4. error objects can run into problems and not get logged:
   * >            https://github.com/winstonjs/winston/issues/600
   */
  log = dependencies.winston || require('winston');
  if (!dependencies.winston) { // if winston is being instantiated within this method then take these actions
    log.remove(log.transports.Console);
    if (process.env.NODE_ENV !== 'test') {
      log.add(log.transports.Console, {
        colorize: true,
        timestamp: false,
        prettyPrint: true,
        level: process.env.LOG_LEVEL_FOR_VEND_NODEJS_SDK || 'debug'
      });
    }
    else {
      // while testing, log only to file, leaving stdout free for unit test status messages
      log.add(log.transports.File, {
        filename: 'vend-nodejs-sdk.log',
        level: process.env.LOG_LEVEL_FOR_VEND_NODEJS_SDK || 'debug'
      });
    }
  }

  // (2) initialize any module-scoped variables which need the dependencies
  // ...

  // (3) expose the SDK
  return {
    args: argsForInput,
    products: {
      fetch: fetchProducts,
      fetchById: fetchProduct,
      fetchByHandle: fetchProductByHandle,
      fetchBySku: fetchProductBySku,
      fetchAll: fetchAllProducts,
      fetchPaginationInfo: fetchPaginationInfo,
      update: updateProductById,
      delete: deleteProductById,
      create: createProduct,
      uploadImage: uploadProductImage
    },
    registers: {
      fetch: fetchRegisters,
      fetchAll: fetchAllRegisters,
      fetchById: fetchRegister
    },
    paymentTypes: {
      fetch: fetchPaymentTypes
    },
    productTypes: {
      fetch: fetchProductTypes,
      create: createProductTypes
    },
    taxes: {
      fetch: fetchTaxes,
      create: createTax
    },
    brands: {
      fetch: fetchBrands,
      create: createBrand
    },
    tags: {
      fetch: fetchTags,
      fetchAll: fetchAllTags,
      create: createTag
    },
    sales: {
      create: createRegisterSale,
      fetch: fetchRegisterSales,
      fetchAll: fetchAllRegisterSales
    },
    customers: {
      create: createCustomer,
      fetch: fetchCustomers,
      fetchByEmail: fetchCustomerByEmail
    },
    consignments: {
      fetchById: fetchConsignment,
      stockOrders: {
        create: createStockOrder,
        markAsSent: markStockOrderAsSent,
        markAsReceived: markStockOrderAsReceived,
        fetch: fetchStockOrdersForSuppliers,
        fetchAll: fetchAllStockOrdersForSuppliers,
        resolveMissingSuppliers: resolveMissingSuppliers,
        remove: deleteStockOrder
      },
      products: {
        create: createConsignmentProduct,
        update: updateConsignmentProduct,
        fetch: fetchProductsByConsignment,
        fetchAllByConsignment: fetchAllProductsByConsignment,
        fetchAllForConsignments: fetchAllProductsByConsignments,
        remove: deleteConsignmentProduct
      }
    },
    outlets:{
      fetchAll: fetchAllOutlets,
      fetch: fetchOutlets, // no need for fetchAll since hardly any Vend customers have more than 200 outlets
      fetchById: fetchOutlet
    },
    suppliers:{
      fetchById: fetchSupplier,
      fetch: fetchSuppliers,
      fetchAll: fetchAllSuppliers,
      create: createSupplier
    },
    hasAccessTokenExpired: hasAccessTokenExpired,
    getInitialAccessToken: getInitialAccessToken,
    refreshAccessToken: refreshAccessToken,
    replacer: replacer
  };
};
