'use strict';

var _ = null;
var moment = null;
var Promise = null;
var request = null;
var log = null;

var utils = null;
var product = null;
var inventory = null;
var consignment = null;
var supplier = null;

// the API consumer will get the args and fill in the blanks
// the SDK will pull out the non-empty values and execute the request
var argsForInput = {
  // products: product.args, // cannot be initialized here, moved to the `exports` function
  // inventory: inventory.args, // cannot be initialized here, moved to the `exports` function
  // consignments: consignment.args, // cannot be initialized here, moved to the `exports` function
  // suppliers: supplier.args, // cannot be initialized here, moved to the `exports` function
  customers: {
    fetch: function () {
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
    },
    fetchAll: function () {
      return {
        after: {
          required: false,
          key: 'after',
          value: undefined
        },
        before: {
          required: false,
          key: 'before',
          value: undefined
        },
        pageSize: {
          required: false,
          key: 'page_size',
          value: undefined
        }
      };
    },
  },
  registers: {
    fetchById: function () {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    },
    fetch: function () {
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
    fetch: function () {
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
    fetchById: function () {
      return {
        apiId: {
          required: true,
          value: undefined
        }
      };
    }
  },
  paymentTypes: {
    fetch: function () {
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
    fetch: function () {
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
    fetch: function () {
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
    fetch: function () {
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
    fetch: function () {
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
    fetch: function () {
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
    },
    fetchById: function () {
      return {
        apiId: {
          required: true,
          value: undefined
        },
        apiVersion: {
          required: false,
          value: undefined
        }
      };
    }
  }
};

var fetchCustomers = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomers()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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

  return utils.sendRequest(options, args, connectionInfo, fetchCustomers, retryCounter);
};

var fetchCustomers2 = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomers2()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      after: args.after.value,
      before: args.before.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchCustomers2, retryCounter);
};

var fetchAllCustomers = function (args, connectionInfo, processPagedResults) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createProductTypes()');
  }
  if (!args.page || !args.page.value) {
    args.page = {value: 1}; // page has no operational role here, just useful for readable logs
  }
  //if (!args.pageSize.value) args.pageSize.value = 10000; // why should we bother to set default pageSize if none is specified?

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllProducts - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.products', data: JSON.stringify(pagedData.products,replacer,2) } );
        if (pagedData.data && pagedData.data.length>0) {
          log.debug('previousData: ' + previousData.length);
          pagedData.data = pagedData.data.concat(previousData);
          log.debug('combined: ' + pagedData.data.length);
        }
        else {
          pagedData.data = previousData;
        }
      }
      return Promise.resolve(pagedData.data);
      // console.log('pagedData', pagedData);
      // return Promise.resolve();
    };
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchCustomers2, processPagedResults);
};

var fetchCustomerByEmail = function (email, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomerByEmail()');
  var args = argsForInput.customers.fetch();
  args.email.value = email;
  return fetchCustomers(args, connectionInfo, retryCounter);
};

var fetchRegisters = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchRegisters()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/registers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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

  return utils.sendRequest(options, args, connectionInfo, fetchRegisters, retryCounter);
};

var fetchAllRegisters = function (args, connectionInfo, processPagedResults) {
  if (!args) {
    args = argsForInput.registers.fetch();
  }
  args.page = {value: 1};
  args.pageSize = {value: 200};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllRegisters - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.products', data: JSON.stringify(pagedData.products,replacer,2) } );
        if (pagedData.registers && pagedData.registers.length>0) {
          log.debug('previousData: ' + previousData.length);
          pagedData.registers = pagedData.registers.concat(previousData);
          log.debug('combined: ' + pagedData.registers.length);
        }
        else {
          pagedData.registers = previousData;
        }
      }
      return Promise.resolve(pagedData.registers);
    };
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchRegisters, processPagedResults);
};

var fetchRegister = function (args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/registers/' + args.apiId.value;
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

  return utils.sendRequest(options, args, connectionInfo, fetchRegister, retryCounter);
};

var fetchPaymentTypes = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchPaymentTypes()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/payment_types';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchPaymentTypes, retryCounter);
};

var fetchAllVersions = function (args, connectionInfo, retryCounter) {

  //In case if args is not passed while calling function
  if (args.accessToken && args.domainPrefix) {
    connectionInfo = args;
    args = {}; //No args are required for this
  }

  log.debug('inside fetchAllVersions()');
  if (!retryCounter) {
    retryCounter = 0;
  }
  else {
    log.debug('retry #' + JSON.stringify(retryCounter, null, 2));
  }

  var path = '/api/2.0/versions';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };
  return utils.sendRequest(options, args, connectionInfo, fetchAllVersions, retryCounter);
};

var fetchProductTypes = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchProductTypes()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/product_types';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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
    qs: {
      after: args.after.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchProductTypes, retryCounter);
};

var createProductTypes = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createProductTypes()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/product_types';
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

  return utils.sendRequest(options, args, connectionInfo, createProductTypes, retryCounter);
};

var fetchTaxes = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchTaxes()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/taxes';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchTaxes, retryCounter);
};

var createTax = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createTax()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/taxes';
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

  return utils.sendRequest(options, args, connectionInfo, createTax, retryCounter);
};

var fetchBrands = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchBrands()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/brands';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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
    qs: {
      after: args.after.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchBrands, retryCounter);
};

var createBrand = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createBrand()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/brands';
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

  return utils.sendRequest(options, args, connectionInfo, createBrand, retryCounter);
};

var fetchTags = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchTags()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/tags';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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
    qs: {
      after: args.after.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchTags, retryCounter);
};

var fetchAllTags = function (args, connectionInfo, processPagedResults) {
  log.debug('inside fetchAllTags()');
  if (!args) {
    args = argsForInput.tags.fetch();
  }
  if (!args.after || !args.after.value) {
    args.after = {value: 0};
  }
  if (!args.page || !args.page.value) {
    args.page = {value: 1}; // page has no operational role here, just useful for readable logs
  }
  if (!args.pageSize || !args.pageSize.value) {
    args.pageSize = {value: 200};
  }

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllTags - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.data', data: JSON.stringify(pagedData.data,replacer,2) } );
        if (pagedData.data && pagedData.data.length>0) {
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
  return utils.processPagesRecursively(args, connectionInfo, fetchTags, processPagedResults);
};

var createTag = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for createTag()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/tags';
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

  return utils.sendRequest(options, args, connectionInfo, createTag, retryCounter);
};

var fetchRegisterSales = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchRegisterSales()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    method: 'GET',
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    },
    qs: {
      since: args.since.value,
      outlet_id: args.outletApiId.value, // eslint-disable-line camelcase
      tag: args.tag.value,
      // WARN: 0.x and 1.0 use `page` and `page_size`, which may or may NOT be implemented on Vend server side for all entities!
      page: args.page.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchRegisterSales, retryCounter);
};

var fetchAllRegisterSales = function (args, connectionInfo, processPagedResults) {
  if (!args) {
    args = argsForInput.sales.fetch();
  }
  args.page = {value: 1};
  args.pageSize = {value: 200};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllRegisterSales - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.products', data: JSON.stringify(pagedData.products,replacer,2) } );
        if (pagedData.register_sales && pagedData.register_sales.length>0) {
          log.debug('previousData: ' + previousData.length);
          pagedData.register_sales = pagedData.register_sales.concat(previousData); // eslint-disable-line camelcase
          log.debug('combined: ' + pagedData.register_sales.length);
        }
        else {
          pagedData.register_sales = previousData; // eslint-disable-line camelcase
        }
      }
      return Promise.resolve(pagedData.register_sales);
    };
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchRegisterSales, processPagedResults);
};

var fetchOutlets = function (args, connectionInfo, retryCounter) {
  log.debug('inside fetchOutlets()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/outlets';
  if (args.path && args.path.value) {
    path = args.path.value;
  }
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

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
    qs: {
      after: args.after.value,
      page_size: args.pageSize.value // eslint-disable-line camelcase
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchOutlets, retryCounter);
};

var fetchAllOutlets = function (args, connectionInfo, processPagedResults) {
  log.debug('inside fetchAllOutlets()');
  if (!args) {
    args = argsForInput.outlets.fetch();
  }
  if (!args.after || !args.after.value) {
    args.after = {value: 0};
  }
  if (!args.page || !args.page.value) {
    args.page = {value: 1}; // page has no operational role here, just useful for readable logs
  }
  if (!args.pageSize || !args.pageSize.value) {
    args.pageSize = {value: 200};
  }
  args.path = {value: '/api/2.0/outlets'};

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllOutlets - default processPagedResults()');
      if (previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.data', data: JSON.stringify(pagedData.data,replacer,2) } );
        if (pagedData.data && pagedData.data.length>0) {
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
  return utils.processPagesRecursively(args, connectionInfo, fetchOutlets, processPagedResults);
};

var fetchOutlet = function (args, connectionInfo, retryCounter) {
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/outlets/' + args.apiId.value;
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting vend outlet ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchOutlet, retryCounter);
};

var createCustomer = function (body, connectionInfo, retryCounter) {
  log.debug('inside createCustomer()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/customers';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;

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

  return utils.sendRequest(options, body, connectionInfo, createCustomer, retryCounter);
};

var fetchRegisterSalesById = function (args, connectionInfo, retryCounter) {
  if (!(args && utils.argsAreValid(args))) {
    return Promise.reject('missing required arguments for fetchRegisterSalesById()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path;
  if (args.apiVersion.value === '0.9') {
    path = '/api/register_sales/' + args.apiId.value;
  }
  else if (args.apiVersion.value === '1.0') {
    path = '/api/1.0/register_sale/' + args.apiId.value;
  }
  else {
    path = '/api/2.0/sales/' + args.apiId.value; // default
  }
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  log.debug('Requesting sale by ID ' + vendUrl);
  var authString = 'Bearer ' + connectionInfo.accessToken;
  log.debug('GET ' + vendUrl);

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchRegisterSalesById, retryCounter);
};

var createRegisterSale = function (body, connectionInfo, retryCounter) {
  log.debug('inside createRegisterSale()');
  if (!retryCounter) {
    retryCounter = 0;
  }else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/register_sales';
  var vendUrl = 'https://' + connectionInfo.domainPrefix + '.vendhq.com' + path;
  var authString = 'Bearer ' + connectionInfo.accessToken;

  try {
    body = _.isObject(body) ? body : JSON.parse(body);
  }
  catch (exception) {
    log.tag('createRegisterSale').error( { message: 'createRegisterSale', error:exception } );
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
  return utils.sendRequest(options, body, connectionInfo, createRegisterSale, retryCounter);
};

var replacer = function (key, value) {
  if (value !== undefined && value !== null) {
    if (typeof value === 'string') {
      if (value.trim().length>0) {
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

module.exports = function (dependencies) {
  // (1) initialize dependencies such that code can be reused both on client and server side
  _ = dependencies.underscore || require('underscore');
  moment = dependencies.moment || require('moment');
  Promise = dependencies.bluebird || require('bluebird');

  request = dependencies['request-promise'] || require('request-promise');
  request.debug = dependencies.debugRequests;

  // NOTE: The authors have decided on an out-of-box logger that is best suited for aggregatign logs in ELK-based production environments.
  //       Due to the logger's interface, and a lack of any kind of facade or wrapper (like logtown) ... this change is not backward compatible.
  //       Users should not upgrade to this version of `vend-nodejs-sdk`
  //       without accounting for:
  //       - how they used to capture logs in the past, and
  //       - how to accommodate this within their infrastructure going forward.
  log = dependencies.logger || require('sp-json-logger');

  // (1.5) add missing dependencies that had to be initialized
  if (!dependencies.underscore) {
    dependencies.underscore = _;
  }
  if (!dependencies.moment) {
    dependencies.moment = moment;
  }
  if (!dependencies.bluebird) {
    dependencies.bluebird = Promise;
  }
  if (!dependencies['request-promise']) {
    dependencies['request-promise'] = request;
  }
  if (!dependencies.logger) {
    dependencies.logger = log;
  }

  // (2) initialize any module-scoped variables which need the dependencies
  utils = require('./lib/utils.js')(dependencies);
  dependencies.utils = utils;

  product = require('./lib/product.js')(dependencies);
  argsForInput.products = product.args;
  dependencies.product = product;

  inventory = require('./lib/inventory.js')(dependencies);
  argsForInput.inventory = inventory.args;
  product.setInventory(inventory);

  consignment = require('./lib/consignment.js')(dependencies);
  argsForInput.consignments = consignment.args;

  supplier = require('./lib/supplier.js')(dependencies);
  argsForInput.suppliers = supplier.args;

  // (3) expose the SDK
  return {
    args: argsForInput,
    products: product.endpoints,
    inventory: inventory.endpoints,
    consignments: consignment.endpoints,
    suppliers: supplier.endpoints,
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
      fetchAll: fetchAllRegisterSales,
      fetchById: fetchRegisterSalesById
    },
    customers: {
      create: createCustomer,
      fetch: fetchCustomers,
      fetchAll: fetchAllCustomers,
      fetchByEmail: fetchCustomerByEmail
    },
    outlets: {
      fetchAll: fetchAllOutlets,
      fetch: fetchOutlets, // no need for fetchAll since hardly any Vend customers have more than 200 outlets
      fetchById: fetchOutlet
    },
    versions: {
      fetchAll: fetchAllVersions
    },
    hasAccessTokenExpired: utils.hasAccessTokenExpired,
    getInitialAccessToken: utils.getInitialAccessToken,
    refreshAccessToken: utils.refreshAccessToken,
    replacer: replacer
  };
};
