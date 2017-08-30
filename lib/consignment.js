'use strict';

var Promise = null;
var log = null;

var utils = null;
var product = null;

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
      fetchById: function() {
        return {
          apiId: {
            required: true,
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
  }
};

// TODO: need to add a test
var defaultMethod_ForProcessingPagedResults_ForConsignmentProducts = function(pagedData, previousData){ // eslint-disable-line camelcase
  log.debug('defaultMethod_ForProcessingPagedResults_ForConsignmentProducts');
  if (previousData && previousData.length>0) {
    //log.verbose(JSON.stringify(pagedData.consignment_products,replacer,2));
    if (pagedData.consignment_products && pagedData.consignment_products.length>0) {
      log.debug('previousData: ', previousData.length);
      pagedData.consignment_products = pagedData.consignment_products.concat(previousData); // eslint-disable-line camelcase
      log.debug('combined: ', pagedData.consignment_products.length);
    }
    else {
      pagedData.consignment_products = previousData; // eslint-disable-line camelcase
    }
  }
  //log.silly('finalData: ', pagedData.consignment_products);
  log.debug('finalData.length: ', pagedData.consignment_products.length);
  return Promise.resolve(pagedData.consignment_products);
};

// TODO: need to add a test
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
    qs: {
      page: args.page.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchStockOrdersForSuppliers, retryCounter);
};

// TODO: need to add a test
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
  return utils.processPagesRecursively(args, connectionInfo, fetchStockOrdersForSuppliers, processPagedResults);
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

  return utils.sendRequest(options, args, connectionInfo, fetchConsignment, retryCounter);
};

// TODO: need to add a test
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
    qs: {
      consignment_id: args.consignmentId.value, // eslint-disable-line camelcase
      page: args.page.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchProductsByConsignment, retryCounter);
};

// TODO: need to add a test
var fetchAllProductsByConsignment = function(args, connectionInfo, processPagedResults) {
  args.page = {value: 1};
  args.pageSize = {value: 200};
  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForConsignmentProducts; // eslint-disable-line camelcase
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchProductsByConsignment, processPagedResults);
};

// TODO: need to add a test
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
  return utils.processPromisesSerially(
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

// TODO: need to add a test
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
  return utils.processPromisesSerially(
    args.getArray(),
    args.getArrayIndex(),
    args,
    function mergeStrategy(newData, previousData, args){
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
      return product.endpoints.fetchProduct(args, connectionInfo);
    }
  );
};

var fetchConsignmentProductById  = function(args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/1.0/consignment_product/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend consignment product ' + vendUrl);
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

  return utils.sendRequest(options, args, connectionInfo, fetchConsignment, retryCounter);
};

var createConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside createConsignmentProduct()');

  var body = null;
  if (args && args.body) {
    body = args.body;
  }
  else {
    if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, createConsignmentProduct, retryCounter);
};

var createStockOrder = function(args, connectionInfo, retryCounter) {
  log.debug('inside createStockOrder()');

  if ( !(args && utils.argsAreValid(args)) ) {
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

  var body = {
    'type': 'SUPPLIER',
    'status': 'OPEN',
    'name': args.name.value,
    'due_at': args.dueAt.value, // caller must format it as `YYYY-MM-DD HH:mm:ss', example: '2010-01-01 14:01:01'
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

  return utils.sendRequest(options, args, connectionInfo, createStockOrder, retryCounter);
};

// TODO: need to add a test
var updateConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside updateConsignmentProduct()', args);

  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, updateConsignmentProduct, retryCounter);
};

var markStockOrderAsSent = function(args, connectionInfo, retryCounter) {
  log.debug('inside markStockOrderAsSent()', args);

  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, markStockOrderAsSent, retryCounter);
};

var markStockOrderAsReceived = function(args, connectionInfo, retryCounter) {
  log.debug('inside markStockOrderAsReceived()', args);

  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, markStockOrderAsReceived, retryCounter);
};

var deleteStockOrder = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteStockOrder()');

  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, deleteStockOrder, retryCounter);
};

var deleteConsignmentProduct = function(args, connectionInfo, retryCounter) {
  log.debug('inside deleteConsignmentProduct()');

  log.debug(args);
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, deleteConsignmentProduct, retryCounter);
};

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  Promise = dependencies.bluebird;
  log = dependencies.winston;

  // (2) initialize any module-scoped variables which need the dependencies
  utils = dependencies.utils;
  product = dependencies.product;

  // (3) expose the SDK
  return {
    args: argsForInput.consignments,
    endpoints: {
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
        fetchById: fetchConsignmentProductById,
        fetchAllByConsignment: fetchAllProductsByConsignment,
        fetchAllForConsignments: fetchAllProductsByConsignments,
        remove: deleteConsignmentProduct
      }
    }
  };
};
