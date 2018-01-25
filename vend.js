'use strict';

var _ = null;
var moment = null;
var Promise = null;
var request = null;
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
    },
    fetchAll: function() {
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

  return utils.sendRequest(options, args, connectionInfo, fetchStockOrdersForSuppliers, retryCounter);
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
  return utils.processPagesRecursively(args, connectionInfo, fetchStockOrdersForSuppliers, processPagedResults);
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

  return utils.sendRequest(options, args, connectionInfo, fetchProductsByConsignment, retryCounter);
};

var defaultMethod_ForProcessingPagedResults_ForConsignmentProducts = function(pagedData, previousData){// jshint ignore:line
  /*jshint camelcase: false */
  log.debug('defaultMethod_ForProcessingPagedResults_ForConsignmentProducts');
  if (previousData && previousData.length>0) {
    //log.trace( { message: 'pagedData.consignment_products', data: JSON.stringify(pagedData.consignment_products,replacer,2) } );
    if (pagedData.consignment_products && pagedData.consignment_products.length>0) {
      log.debug('previousData: ', previousData.length);
        pagedData.consignment_products = pagedData.consignment_products.concat(previousData);
      log.debug('combined: ', pagedData.consignment_products.length);
      }
    else {
      pagedData.consignment_products = previousData;
    }
  }
  //log.trace( { message: 'finalData', data: pagedData.consignment_products } );
  log.debug('finalData.length: ', pagedData.consignment_products.length);
      return Promise.resolve(pagedData.consignment_products);
};

var defaultMethod_ForProcessingPagedResults_ForSuppliers = function processPagedResults(pagedData, previousData){// jshint ignore:line
  log.debug('defaultMethod_ForProcessingPagedResults_ForSuppliers');
  if (previousData && previousData.length>0) {
    //log.trace( { message: 'pagedData.suppliers', data: JSON.stringify(pagedData.suppliers,replacer,2) } );
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
  return utils.processPagesRecursively(args, connectionInfo, fetchProductsByConsignment, processPagedResults);
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
  return utils.processPromisesSerially(
    args.consignmentIds.value,
    args.consignmentIdIndex.value,
    args,
    function mergeStrategy(newData, previousData){
      log.debug('inside mergeStrategy()');
      //log.trace( { message: 'newData', data: newData } );
      //log.trace( { message: 'previousData', data: previousData } );
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
      //log.trace( { message: 'finalData', data: newData } );
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
      //log.trace( { message: 'updatedArgs', data: updatedArgs } );
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
  return utils.processPromisesSerially(
    args.getArray(),
    args.getArrayIndex(),
    args,
    function mergeStrategy(newData, previousData, args){/*jshint camelcase: false */
      log.debug('resolveMissingSuppliers - inside mergeStrategy()');
      var product = newData.products[0];
      //log.trace( { message: 'newData', data: newData } );
      //log.trace( { message: 'product', data: product } );
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
      //log.trace( { message: 'updatedArgs', data: updatedArgs } );
      var args = argsForInput.products.fetchById();
      args.apiId.value = updatedArgs.consignmentProductId.value;
      return product.fetchProduct(args, connectionInfo);
    }
  );
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

var fetchCustomers2 = function(args, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomers2()');
  if (!retryCounter) {
    retryCounter = 0;
  } else {
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
      page_size: args.pageSize.value // jshint ignore:line
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchCustomers2, retryCounter);
};

var fetchAllCustomers = function(args, connectionInfo, processPagedResults) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for createProductTypes()');
  }
  if (!args.page || !args.page.value) {
    args.page = {value:1}; // page has no operational role here, just useful for readable logs
  }
  //if (!args.pageSize.value) args.pageSize.value = 10000; // why should we bother to set default pageSize if none is specified?

  // set a default function if none is provided
  if(!processPagedResults) {
    processPagedResults = function processPagedResults(pagedData, previousData) {
      log.debug('fetchAllProducts - default processPagedResults()');
      if(previousData && previousData.length>0) {
        //log.trace( { message: 'pagedData.products', data: JSON.stringify(pagedData.products,replacer,2) } );
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
      // console.log('pagedData', pagedData);
      // return Promise.resolve();
    };
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchCustomers2, processPagedResults);
};

var fetchCustomerByEmail = function(email, connectionInfo, retryCounter) {
  log.debug('inside fetchCustomerByEmail()');
  var args = argsForInput.customers.fetch();
  args.email.value = email;
  return fetchCustomers(args, connectionInfo, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, fetchRegisters, retryCounter);
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
        //log.trace( { message: 'pagedData.registers', data: JSON.stringify(pagedData.registers,replacer,2) } );
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
  return utils.processPagesRecursively(args, connectionInfo, fetchRegisters, processPagedResults);
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

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchRegister, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, fetchProductTypes, retryCounter);
};

var createProductTypes = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

var createTax = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, fetchBrands, retryCounter);
};

var createBrand = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, fetchTags, retryCounter);
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
        //log.trace( { message: 'pagedData.data', data: JSON.stringify(pagedData.data,replacer,2) } );
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
  return utils.processPagesRecursively(args, connectionInfo, fetchTags, processPagedResults);
};

var createTag = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  return utils.sendRequest(options, args, connectionInfo, fetchRegisterSales, retryCounter);
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
        //log.trace( { message: 'pagedData.register_sales', data: JSON.stringify(pagedData.register_sales,replacer,2) } );
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
  return utils.processPagesRecursively(args, connectionInfo, fetchRegisterSales, processPagedResults);
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

  return utils.sendRequest(options, args, connectionInfo, fetchOutlets, retryCounter);
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
        //log.trace( { message: 'pagedData.data ', data: JSON.stringify(pagedData.data ,replacer,2) } );
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
  return utils.processPagesRecursively(args, connectionInfo, fetchOutlets, processPagedResults);
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

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchOutlet, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, fetchSuppliers, retryCounter);
};

var fetchAllSuppliers = function(connectionInfo, processPagedResults) {
  var args = argsForInput.suppliers.fetchAll();
  args.page.value = 1;
  args.pageSize.value = 200;

  // set a default function if none is provided
  if (!processPagedResults) {
    processPagedResults = defaultMethod_ForProcessingPagedResults_ForSuppliers;// jshint ignore:line
  }
  return utils.processPagesRecursively(args, connectionInfo, fetchSuppliers, processPagedResults);
};

var createSupplier = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
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

  var options = {
    url: vendUrl,
    headers: {
      'Authorization': authString,
      'Accept': 'application/json'
    }
  };

  return utils.sendRequest(options, args, connectionInfo, fetchConsignment, retryCounter);
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

  return utils.sendRequest(options, args, connectionInfo, createStockOrder, retryCounter);
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

var fetchRegisterSalesById  = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchRegisterSalesById()');
  }

  if (!retryCounter) {
    retryCounter = 0;
  } else {
    log.debug('retry # ' + retryCounter);
  }

  var path = '/api/2.0/sales/' + args.apiId.value;
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
  return utils.sendRequest(options, body, connectionInfo, createRegisterSale, retryCounter);
};

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

  // NOTE: The authors have decided on an out-of-box logger that is best suited for aggregatign logs in ELK-based production environments.
  //       Due to the logger's interface, and a lack of any kind of facade or wrapper (like logtown) ... this change is not backward compatible.
  //       Users should not upgrade to this version of `vend-nodejs-sdk`
  //       without accounting for:
  //       - how they used to capture logs in the past, and
  //       - how to accommodate this within their infrastructure going forward.
  log = dependencies.logger || require('sp-json-logger');

  // (1.5) add missing dependencies that had to be initialized
  if (!dependencies.underscore) {dependencies.underscore = _;}
  if (!dependencies.moment) {dependencies.moment = moment;}
  if (!dependencies.bluebird) {dependencies.bluebird = Promise;}
  if (!dependencies['request-promise']) {dependencies['request-promise'] = request;}
  if (!dependencies.logger) {dependencies.logger = log;}

  // (2) initialize any module-scoped variables which need the dependencies
  utils = require('./lib/utils.js')(dependencies);
  dependencies.utils = utils;
  //product = require('./lib/product.js')(dependencies);
  product = require('./lib/product.js')(dependencies);
  //console.log('product', product);
  argsForInput.products = product.args;
  //console.log('argsForInput', argsForInput);

  // (3) expose the SDK
  return {
    args: argsForInput,
    products: product.endpoints,
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
        fetchById: fetchConsignmentProductById,
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
    getInitialAccessToken: utils.getInitialAccessToken,
    refreshAccessToken: utils.refreshAccessToken,
    replacer: replacer
  };
};
