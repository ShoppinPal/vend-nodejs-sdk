'use strict';

var _ = null;
var moment = null;
var Promise = null;
var request = null;
var log = null;

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

var successHandler = function(response) {
  if(_.isArray(response)) {
    console.log('response is an array');
  }
  else if(_.isObject(response)) {
    console.log('response is an object');
    return Promise.resolve(response);
  }
  else if(_.isString(response)) {
    console.log('response is a string');
    try{
      var responseObject = JSON.parse(response);
      //console.log(responseObject);
      return Promise.resolve(responseObject);
    }
    catch(error){
      console.error('caught an error: ', error);
      throw error;
    }
  }
  else {
    console.log(response);
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
    console.log('retry after: ' + retryAfter + ' ms');

    return Promise.delay(retryAfter)
      .then(function() {
        console.log(retryAfter + ' ms have passed...');
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

    console.log('try to fetch a new access token');
    return refreshAccessToken( //TODO: validate connectionInfo before using it for retries?
      connectionInfo.vendTokenService,
      connectionInfo.vendClientId,
      connectionInfo.vendClientSecret,
      connectionInfo.refreshToken,
      connectionInfo.domainPrefix
    )
      .then(function(oauthInfo) {
        console.log('update connectionInfo w/ new token before using it again');
        if (oauthInfo.access_token) {
          console.log('received new access_token: ' + oauthInfo.access_token);
          connectionInfo.accessToken = oauthInfo.access_token;
        }
        if (oauthInfo.refresh_token) {
          console.log('received new refresh_token: ' + oauthInfo.refresh_token);
          connectionInfo.refreshToken = oauthInfo.refresh_token;
        }

        console.log('retrying with new accessToken: ' + connectionInfo.accessToken);
        return callback(args, connectionInfo, ++retryCounter);
      });
  }
};

var sendRequest = function(options, args, connectionInfo, callback, retryCounter) {
  if ( !(connectionInfo && connectionInfo.accessToken && connectionInfo.domainPrefix) ) {
    return Promise.reject('missing required arguments for sendRequest()');
  }
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
      return retryWhenRateLimited(bodyObject, args, connectionInfo, callback, retryCounter);
      // TODO: how should a catch-block respond if there is a problem within the retry?
    })
    .catch(AuthNError, function(e) {
      console.log('An AuthNError happened: \n'
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
      console.log('A ClientError happened: \n'
          + e.statusCode + ' ' + message + '\n'
        /*+ JSON.stringify(e.response.headers,null,2)
         + JSON.stringify(e,null,2)*/
      );

      // TODO: add retry logic

      return Promise.reject(e.statusCode + ' ' + e.response.body); // TODO: throw unknown errors but reject well known errors?
    })
    .catch(function(e) {
      console.error('vend.js - sendRequest - An unexpected error occurred: ', e);
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
var getTokenUrl = function(tokenService, domain_prefix) {
  var tokenUrl = tokenService.replace(/\{DOMAIN_PREFIX\}/, domain_prefix);
  log.debug('token Url: '+ tokenUrl);
  return tokenUrl;
};

function processPagesRecursively(args, connectionInfo, fetchSinglePage, processPagedResults, previousProcessedResults){
  'use strict';
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

      if(result.pagination && result.pagination.pages > args.page.value) {
        log.info('# of entries returned: ' + result.pagination.results);
        log.info('Page # ' + args.page.value + ' of ' + result.pagination.pages);
        return processPagedResults(result, previousProcessedResults)
          .then(function(newlyProcessedResults){
            args.page.value = args.page.value+1;
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
    console.log('processPromisesSerially for aArrayIndex # ' + aArrayIndex);
    return executeNext(args)
      .then(function(executedResults){
        //console.log('executedResults ', executedResults);
        //console.log('executedResults.length ', executedResults.length); // .length may not be valid everytime
        return mergeStrategy(executedResults, aPreviousResults, args)
          .then(function(mergedResults){
            console.log('mergedResults.length ', mergedResults.length);
            //console.log('before: ', args);
            args = setupNext(args);
            //console.log('after: ', args);
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
    console.log('aPreviousResults.length ', aPreviousResults.length);
    }
    console.log('processPromisesSerially() finished');
    return Promise.resolve(aPreviousResults);
  }
};

var argsAreValid = function(args){
  var arrayOfRequiredArgs = _.filter(args, function(object, key){
    return object.required;
  });
  var arrayOfRequiredValues = _.pluck(arrayOfRequiredArgs, 'value');
  return !_.contains(arrayOfRequiredValues, undefined);
};

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
  consignments: {
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
    }
  }
};

var fetchStockOrdersForSuppliers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchStockOrderForSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/consignment';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
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
        console.log('previousData: ', previousData.length);
        pagedData.consignments = pagedData.consignments.concat(previousData);
        console.log('combined: ', pagedData.consignments.length);
      }
        else {
          pagedData.consignments = previousData;
        }
      }
      return Promise.resolve(pagedData.consignments);
    }
  }
  return processPagesRecursively(args, connectionInfo, fetchStockOrdersForSuppliers, processPagedResults);
};

var fetchProductsByConsignment  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/consignment_product';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  console.log('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      consignment_id: args.consignmentId.value,
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProductsByConsignment, retryCounter);
};

var defaultMethod_ForProcessingPagedResults_ForConsignmentProducts = function(pagedData, previousData){
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
  //console.log('finalData: ', pagedData.consignment_products);
  console.log('finalData.length: ', pagedData.consignment_products.length);
      return Promise.resolve(pagedData.consignment_products);
};

var defaultMethod_ForProcessingPagedResults_ForSuppliers = function processPagedResults(pagedData, previousData){
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
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForConsignmentProducts;
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
      console.log('inside mergeStrategy()');
      //console.log('newData ', newData);
      //console.log('previousData ', previousData);
      if (previousData && previousData.length>0) {
        if (newData.length>0) {
        console.log('previousData.length: ', previousData.length);
        newData = newData.concat(previousData);
        console.log('combinedData.length: ', newData.length);
      }
        else {
          newData = previousData;
        }
      }
      //console.log('finalData ', newData);
      console.log('finalData.length ', newData.length);
      return Promise.resolve(newData); // why do we need a promise?
    },
    function setupNext(updateArgs){
      updateArgs.consignmentIdIndex.value = updateArgs.consignmentIdIndex.value + 1;
      if (updateArgs.consignmentIdIndex.value < updateArgs.consignmentIds.value.length) {
        updateArgs.consignmentId.value = updateArgs.consignmentIds.value[updateArgs.consignmentIdIndex.value];
        console.log('next is consignmentId: ' + updateArgs.consignmentId.value);
      }
      else {
        updateArgs.consignmentId.value = null;
        console.log('finished iterating through all the consignmentIds');
      }
      return updateArgs;
    },
    function executeNext(updatedArgs){
      console.log('executing for consignmentId: ' + updatedArgs.consignmentId.value);
      //console.log('updatedArgs: ', updatedArgs);
      return fetchAllProductsByConsignment(updatedArgs, connectionInfo);
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
    function mergeStrategy(newData, previousData, args){
      console.log('resolveMissingSuppliers - inside mergeStrategy()');
      var product = newData.products[0];
      //console.log('newData: ', newData);
      //console.log('product: ', product);
      var updateMe = args.getArray()[args.getArrayIndex()];
      updateMe.supplier = product.supplier_name || product.supplier_code;
      console.log('updated consignmentIdToProductIdMap: ', args.getArray()[args.getArrayIndex()]);

      previousData = args.getArray();
      return Promise.resolve(previousData); // why do we need a promise?
    },
    function setupNext(updateArgs){
      console.log('resolveMissingSuppliers - inside setupNext()');
      updateArgs.arrayIndex.value = updateArgs.getArrayIndex() + 1;
      if (updateArgs.getArrayIndex() < updateArgs.getArray().length) {
        updateArgs.consignmentProductId.value = updateArgs.getArray()[updateArgs.getArrayIndex()].productId;
        console.log('resolveMissingSuppliers - next is consignmentId: ' + updateArgs.consignmentProductId.value);
      }
      else {
        updateArgs.consignmentProductId.value = null;
        console.log('resolveMissingSuppliers - finished iterating through all the consignmentIds');
      }
      return updateArgs;
    },
    function executeNext(updatedArgs){
      console.log('resolveMissingSuppliers - inside executeNext()');
      console.log('resolveMissingSuppliers - executing for consignmentProductId: ' + updatedArgs.consignmentProductId.value);
      //console.log('updatedArgs: ', updatedArgs);
      var args = argsForInput.products.fetchById();
      args.apiId.value = updatedArgs.consignmentProductId.value;
      return fetchProduct(args, connectionInfo);
    }
  );
};

// WARN: if the ID is incorrect, the vend api the first 50 products which can totally throw folks off their mark!
// TODO: instead of returning response, return the value of response.products[0] directly?
var fetchProduct  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/products/' + args.apiId.value;
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  console.log('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchProduct, retryCounter);
};

// TODO: instead of returning response, return the value of response.products[0] directly?
var fetchProductByHandle  = function(args, connectionInfo, retryCounter) {
  if ( !(args && args.handle && args.handle.value) ) {
    return Promise.reject('missing required arguments for fetchProductByHandle()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/products';
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  console.log('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/products';
  // this is an undocumented implementation by Vend
  // the response has to be accessed like: result.products[0]
  // which is lame ... TODO: should we unwrap it within the SDK?

  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  console.log('Requesting vend product ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/products';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  //var domainPrefix = this.domainPrefix;

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
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
          console.log('previousData: ', previousData.length);
          pagedData.products = pagedData.products.concat(previousData);
          console.log('combined: ', pagedData.products.length);
        }
        else {
          pagedData.products = previousData;
        }
      }
      return Promise.resolve(pagedData.products);
    }
  }
  return processPagesRecursively(args, connectionInfo, fetchProducts, processPagedResults);
};

var fetchCustomerByEmail = function(email, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomerByEmail()');
  var args = args.customers.fetch();
  args.email.value = email;
  fetchCustomers(args, connectionInfo, retryCounter);
};

var fetchCustomers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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

var fetchRegisterSales = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchRegisterSales()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      since: args.since.value,
      outlet_id: args.outletApiId.value,
      tag: args.tag.value,
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };

  return sendRequest(options, args, connectionInfo, fetchRegisterSales, retryCounter);
};

var fetchAllRegisterSales = function(args, connectionInfo, processPagedResults) {
  if (!args) {
    args = argsForInput.sales.fetch();
  };
  args.page = {value:1};
  args.pageSize = {value:200};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllRegisterSales - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.products,replacer,2));
        if (pagedData.register_sales && pagedData.register_sales.length>0) {
          console.log('previousData: ', previousData.length);
          pagedData.register_sales = pagedData.register_sales.concat(previousData);
          console.log('combined: ', pagedData.register_sales.length);
        }
        else {
          pagedData.register_sales = previousData;
        }
      }
      return Promise.resolve(pagedData.register_sales);
    }
  }
  return processPagesRecursively(args, connectionInfo, fetchRegisterSales, processPagedResults);
};

//TODO: maybe reorder as: (connectionInfo, args, retryCounter) ... ?
var fetchOutlets = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchOutlets()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/outlets';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }/*,
    qs: { // NOTE: page and page_size are NOT implemented on Vend server side! For ex: page=1,page_size=1 doesn't work
      page: args.page.value,
      page_size: args.pageSize.value
    }*/
  };

  return sendRequest(options, args, connectionInfo, fetchOutlets, retryCounter);
};

var fetchSupplier = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/supplier/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return sendRequest(options, args, connectionInfo, fetchSuppliers, retryCounter);
};

var fetchSuppliers = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/supplier';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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
    options.qs = {
      page: args.page.value,
      page_size: args.pageSize.value
    }
    console.log(options);
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
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForSuppliers;
  }
  return processPagesRecursively(args, connectionInfo, fetchSuppliers, processPagedResults);
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
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/consignment_product';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/consignment';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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

  return sendRequest(options, body, connectionInfo, createStockOrder, retryCounter);
};

var createCustomer = function(body, connectionInfo, retryCounter) {
  log.debug('inside createCustomer()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

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
    console.log('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('Authorization: ' + authString); // TODO: sensitive data ... do not log?

  try {
    body = _.isObject(body) ? body : JSON.parse(body);
  }
  catch(exception) {
    console.log(exception);
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
  //request.debug = true;

  log = dependencies.winston || require('winston');
  log.remove(log.transports.Console);
  log.add(log.transports.Console, {colorize: true, timestamp: false, level: 'debug'});

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
      fetchAll: fetchAllProducts
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
      stockOrders: {
        create: createStockOrder,
        fetch: fetchStockOrdersForSuppliers,
        fetchAll: fetchAllStockOrdersForSuppliers,
        resolveMissingSuppliers: resolveMissingSuppliers
      },
      products: {
        create: createConsignmentProduct,
        fetch: fetchProductsByConsignment,
        fetchAllByConsignment: fetchAllProductsByConsignment,
        fetchAllForConsignments: fetchAllProductsByConsignments
      }
    },
    outlets:{
      fetch: fetchOutlets, // no need for fetchAll since hardly any Vend customers have more than 200 outlets
    },
    suppliers:{
      fetchById: fetchSupplier,
      fetch: fetchSuppliers,
      fetchAll: fetchAllSuppliers,
    },
    hasAccessTokenExpired: hasAccessTokenExpired,
    getInitialAccessToken: getInitialAccessToken,
    refreshAccessToken: refreshAccessToken,
    replacer: replacer
  };
};