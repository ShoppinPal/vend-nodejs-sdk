'use strict';

var Promise = null;
var log = null;

var utils = null;

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
  suppliers: {
    fetchAll: function () {
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
        },
        deleted: {
          required: false,
          key: 'deleted',
          value: undefined
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
        page: {
          required: false,
          key: 'page',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        },
        deleted: {
          required: false,
          key: 'deleted',
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
    },
    delete: function () {
      return {
        apiId: {
          required: true,
          //id: undefined, // does not travel as a key/value property in the JSON payload
          value: undefined
        }
      };
    }
  }
};

var defaultMethod_ForProcessingPagedResults_ForSuppliers = function processPagedResults(pagedData, previousData) { // eslint-disable-line camelcase
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

var fetchSupplier = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
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

  return utils.sendRequest(options, args, connectionInfo, fetchSupplier, retryCounter);
};

var fetchSuppliers = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchSuppliers()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/suppliers';
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

  if (args.page && args.pageSize) {
    // NOTE: page and page_size work! For ex: page=1,page_size=1 return just one result in response.suppliers
    options.qs = {
      page: args.page.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    };
    // NOTE: BUT for this endpoint, the paging properties in the response are part of the immediate response,
    //       instead of being nested one-level-down under the response.pagination structure!
  }
  if (args.after) {
    options.qs.after = args.after.value;
  }
  if (args.before) {
    options.qs.before = args.before.value;
  }
  if (args.deleted) {
    options.qs.deleted = args.deleted.value;
  }
  log.debug(options);

  return utils.sendRequest(options, args, connectionInfo, fetchSuppliers, retryCounter);
};

var fetchAllSuppliers = function (connectionInfo, processPagedResults) {
  var args = argsForInput.suppliers.fetchAll();
  args.page.value = 1;
  args.pageSize.value = 200;

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForSuppliers; // eslint-disable-line camelcase
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchSuppliers, processPagedResults);
};

var createSupplier = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createSupplier()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
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

  return utils.sendRequest(options, args, connectionInfo, createSupplier, retryCounter);
};

var deleteSupplierById = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for deleteSupplier()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/supplier/' + args.apiId.value;
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

  return utils.sendRequest(options, args, connectionInfo, deleteSupplierById, retryCounter);
};

module.exports = function (dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  Promise = dependencies.bluebird;
  log = dependencies.winston;

  // (2) initialize any module-scoped variables which need the dependencies
  utils = dependencies.utils;

  // (3) expose the SDK
  return {
    args: argsForInput.suppliers,
    endpoints: {
      fetchById: fetchSupplier,
      fetch: fetchSuppliers,
      fetchAll: fetchAllSuppliers,
      create: createSupplier,
      delete: deleteSupplierById
    }
  };
};
