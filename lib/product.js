'use strict';

var _ = null;
var Promise = null;
var log = null;

var utils = null;

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
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
          /**
           * TODO: can we embed a transformation here?
           *       API consumer will set true or false or 0 or 1 as the value
           *       but SDK will get the 0 or 1 value based on a transformation
           */
          value: undefined,
          description: '0 (or no value) : returns only inactive products\n' +
                       '1 (or any other value) : returns only active products'
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
    fetchAll: function() {
      return {
        active: {
          required: false,
          key: 'active',        
          value: undefined,
          description: '0 (or no value) : returns only inactive products\n' +
                       '1 (or any other value) : returns only active products\n' +
                       'undefined : returns both active and inactive products'
        },
      };
    },
    fetch2: function () {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined,
          description: 'The lower limit for the version numbers to be included in the response.'
        },
        before: {
          required: false,
          key: 'before',
          value: undefined,
          description: 'The upper limit for the version numbers to be included in the response.'
        },
        deleted: {
          required: false,
          key: 'deleted',
          value: undefined,
          description: 'Indicates whether deleted items should be included in the response.'
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined,
          description: 'The maximum number of items to be returned in the response.'
        },
        page: {
          required: false,
          key: 'page',
          value: undefined,
          description: 'The page number of response. Not supported by Vend API, just for informational logs.'
        }
      };
    },
    fetchAll2: function () {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined,
          description: 'The lower limit for the version numbers to be included in the response.'
        },
        before: {
          required: false,
          key: 'before',
          value: undefined,
          description: 'The upper limit for the version numbers to be included in the response.'
        },
        deleted: {
          required: false,
          key: 'deleted',
          value: undefined,
          description: 'Indicates whether deleted items should be included in the response.'
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined,
          description: 'The maximum number of items to be returned in the response.'
        },
        page: {
          required: false,
          key: 'page',
          value: undefined,
          description: 'The page number of response. Not supported by Vend API, just for informational logs.'
        }
      };
    },
  }
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

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchProduct, retryCounter);
};

/**
 * This method updates a product by product Id.
 * The product's id is passed in the `body` as a json object along with other parameters
 * instead of passing it in the url as querystring. That's how an update happens in Vend.
 */
var updateProductById = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, updateProductById, retryCounter);
};

var deleteProductById = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteProductById()');

  log.debug(args);
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, deleteProductById, retryCounter);
};

var createProduct = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, createProduct, retryCounter);
};

var uploadProductImage = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, uploadProductImage, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, fetchProductByHandle, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, fetchProductBySku, retryCounter);
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

  //var domainPrefix = this.domainPrefix;

  var active;
  if (args.active.value===undefined || args.active.value===null) {
    active = undefined;
  } else {
    active = (args.active.value) ? 1 : 0;
  }
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
      active: active,
      page: args.page.value,
      page_size: args.pageSize.value
    }
  };
  if (args.page.value) {
    log.debug('Requesting product page ' + args.page.value);
  }

  return utils.sendRequest(options, args, connectionInfo, fetchProducts, retryCounter);
};

var fetchAllProducts = function(args, connectionInfo, processPagedResults) {
  var defaultArgs = argsForInput.products.fetch();
  defaultArgs.orderBy.value = 'id';
  defaultArgs.page.value = 1;
  defaultArgs.pageSize.value = 200;
  defaultArgs.active.value = true; // fetch only active products by default

  /*
   * This method's signature changed
   * FROM:
   *     function(connectionInfo, processPagedResults)
   * TO:
   *     function(args, connectionInfo, processPagedResults)
   * therefore, the following section massages arguments to provide backward compatibility.
   */
  var input = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
  if (input.length===1) { // backward compatible with old method signature
    connectionInfo = input[0];
  }
  else if (input.length===2 && _.isFunction(input[1])) { // backward compatible with old method signature
    connectionInfo = input[0];
    processPagedResults = input[1];
  }
  else if (
    ( input.length===2 ) ||
    ( input.length===3 && _.isFunction(input[2]) ) ) // new method signature calls, will end up using this code-block
  {
    if ( !(args && utils.argsAreValid(args)) ) {
      return Promise.reject('missing required arguments for fetchAllProducts()');
    }
    if (!args.active || args.active.value===undefined || args.active.value===null) {
      // in Vend API, not specifying this field is a way of saying
      // that you want both: active AND inactive products
      defaultArgs.active.value = undefined;
    }
    else {
      defaultArgs.active.value = args.active.value;
    }
  }
  else {
    return Promise.reject('please check the method signature and fix your code');
  }
  // method signature related changes END

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData){
      log.debug('fetchAllProducts - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.products', data: JSON.stringify(pagedData.products,replacer,2) } );
        if (pagedData.products && pagedData.products.length>0) {
          log.debug('previousData: ' + previousData.length);
          pagedData.products = pagedData.products.concat(previousData);
          log.debug('combined: ' + pagedData.products.length);
        }
        else {
          pagedData.products = previousData;
        }
      }
      return Promise.resolve(pagedData.products);
    };
  }
  return utils.processPagesRecursively(defaultArgs, connectionInfo, fetchProducts, processPagedResults);
};

var fetchProducts2 = function (args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/products';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  //var domainPrefix = this.domainPrefix;

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      /*jshint camelcase: false */
      after: args.after.value,
      before: args.before.value,
      deleted: args.deleted.value,
      page_size: args.pageSize.value
    }
  };
  if (args.page.value) {
    log.debug('Requesting product page ' + args.page.value);
  }

  return utils.sendRequest(options, args, connectionInfo, fetchProducts2, retryCounter);
};

var fetchAllProducts2 = function(args, connectionInfo, processPagedResults) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchAllProducts()');
  }
  if (!args.page.value) {
    args.page.value = 1; // set a default if its missing
  }

  // set a default function if none is provided
  if(!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllProducts - default processPagedResults()');
      if(previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.data', data: JSON.stringify(pagedData.data,replacer,2) } );
        if(pagedData.data && pagedData.data.length>0) {
          log.debug('previousData: ' + previousData.length);
          pagedData.data = pagedData.data.concat(previousData);
          log.debug('combined: ' + pagedData.data.length);
        }
        else {
          pagedData.data = previousData;
        }
      }
      return Promise.resolve(pagedData.data);
    };
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchProducts2, processPagedResults);
};

var fetchPaginationInfo = function(args, connectionInfo){
  if ( !(args && utils.argsAreValid(args)) ) {
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

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore;
  Promise = dependencies.bluebird;
  log = dependencies.logger;

  // (2) initialize any module-scoped variables which need the dependencies
  utils = dependencies.utils;

  // (3) expose the SDK
  return {
    args: argsForInput.products,
    endpoints: {
      fetch: fetchProducts,
      fetch2: fetchProducts2,
      fetchById: fetchProduct,
      fetchByHandle: fetchProductByHandle,
      fetchBySku: fetchProductBySku,
      fetchAll: fetchAllProducts,
      fetchAll2: fetchAllProducts2,
      fetchPaginationInfo: fetchPaginationInfo,
      update: updateProductById,
      delete: deleteProductById,
      create: createProduct,
      uploadImage: uploadProductImage
    }
  };
};
