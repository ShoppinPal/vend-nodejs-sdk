'use strict';

var _ = null;
var Promise = null;
var log = null;

var utils = null;
var product = null;

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
  inventory: {
    // fetchByProductId: product.args.fetchProductInventory, // cannot be initialized here, moved to the `exports` function
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

var fetchInventoryByProductId = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchInventoryByProductId()');
  }
  return product.endpoints.fetchProductInventory(args, connectionInfo, retryCounter); // delegate
};

var fetchInventory = function (args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchInventoryByProductId()');
  }
  if(!args.page.value) {
    args.page.value = 1; // default
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/inventory';
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
      page_size: args.pageSize.value
    }
  };
  if (args.page.value) {
    log.debug('Requesting inventory page ' + args.page.value);
  }

  return utils.sendRequest(options, args, connectionInfo, fetchInventory, retryCounter);
};

var fetchAllInventory = function(args, connectionInfo, processPagedResults) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchAllInventory()');
  }
  if (!args.page.value) {
    args.page.value = 1; // set a default if its missing
  }

  // set a default function if none is provided
  if(!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllInventory - default processPagedResults()');
      if(previousData && previousData.length>0) {
        //log.verbose(JSON.stringify(pagedData.data,replacer,2));
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
  return utils.processPagesRecursively(args, connectionInfo, fetchInventory, processPagedResults);
};

module.exports = function(dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore;
  Promise = dependencies.bluebird;
  log = dependencies.winston;

  // (2) initialize any module-scoped variables which need the dependencies
  utils = dependencies.utils;
  product = dependencies.product;
  argsForInput.inventory.fetchByProductId = product.args.fetchProductInventory;

  // (3) expose the SDK
  return {
    args: argsForInput.inventory,
    endpoints: {
      fetchByProductId: fetchInventoryByProductId
      , fetch: fetchInventory
      , fetchAll: fetchAllInventory
    }
  };
};
