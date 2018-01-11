'use strict';

var _ = null;
var Promise = null;
var log = null;

var utils = null;

var inventory = null;
var setInventory = function(aInventory){
  inventory = aInventory;
};

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
    fetchProductInventory: function () {
      return {
        apiId: {
          required: true,
          key: 'product_id',
          value: undefined,
          description: 'Valid product ID.'
        },
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
    fetch: function () {
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
    fetchAll: function () {
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
    }
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

var fetchInventoryByProductId = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchInventoryByProductId()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/products/' + args.apiId.value + '/inventory';
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

  return utils.sendRequest(options, args, connectionInfo, fetchInventoryByProductId, retryCounter);
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

var fetchProducts = function (args, connectionInfo, retryCounter) {
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
      after: args.after.value,
      before: args.before.value,
      deleted: args.deleted.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };
  if (args.page.value) {
    log.debug('Requesting product page ' + args.page.value);
  }

  return utils.sendRequest(options, args, connectionInfo, fetchProducts, retryCounter);
};

var fetchAllProducts = function(args, connectionInfo, processPagedResults) {
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
        if(pagedData.data && pagedData.data.length>0) {
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
  return utils.processPagesRecursively(args, connectionInfo, fetchProducts, processPagedResults);
};

var fetchAllProductsWithInventoryDataIncluded = function(args, connectionInfo) {
  var productArgs = argsForInput.products.fetchAll();
  productArgs.pageSize.value = 50000;
  return fetchAllProducts(productArgs, connectionInfo)
    .then(function(allProducts){
      var inventoryArgs = inventory.args.fetchAll();
      inventoryArgs.pageSize.value = 50000; // currently observed maximum - no guarantees - asking for more still gives only 500 per page
      return inventory.endpoints.fetchAll(inventoryArgs, connectionInfo)
        .then(function(allInventory){
          var productsById = _.indexBy(allProducts, 'id');
          var inventoryByProductId = _.groupBy(allInventory, 'product_id');
          _.each(productsById, function(product, id){
            product.inventory = inventoryByProductId[id];
          });
          inventoryByProductId = null; // cleanup
          return Promise.resolve(_.values(productsById));
        });
    });
};

/**
 * TODO: Should this be deprecated? Since, we have moved on to vend api version 2.0?
 */
var fetchPaginationInfo = function(args, connectionInfo){
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchPaginationInfo()');
  }
  return fetchProducts(args, connectionInfo)
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

      return (result && result.pagination) ? Promise.resolve(result.pagination) : Promise.resolve();
    });
};

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore;
  Promise = dependencies.bluebird;
  log = dependencies.winston;

  // (2) initialize any module-scoped variables which need the dependencies
  utils = dependencies.utils;

  // (3) expose the SDK
  return {
    args: argsForInput.products,
    setInventory: setInventory,
    endpoints: {
      fetch: fetchProducts,
      fetchById: fetchProduct,
      fetchByHandle: fetchProductByHandle,
      fetchBySku: fetchProductBySku,
      fetchProductInventory: fetchInventoryByProductId,
      fetchAll: fetchAllProducts,
      fetchAllWithInventory: fetchAllProductsWithInventoryDataIncluded,
      fetchPaginationInfo: fetchPaginationInfo,
      update: updateProductById,
      delete: deleteProductById,
      create: createProduct,
      uploadImage: uploadProductImage
    }
  };
};
