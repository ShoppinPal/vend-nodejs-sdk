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
  }
};

var fetchInventoryByProductId = function(args, connectionInfo, retryCounter) {
  if ( !(args && utils.argsAreValid(args)) ) {
    return Promise.reject('missing required arguments for fetchInventoryByProductId()');
  }
  return product.endpoints.fetchProductInventory(args, connectionInfo, retryCounter); // delegate
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
    }
  };
};
