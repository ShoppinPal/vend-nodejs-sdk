vend-js-sdk
===========

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ShoppinPal/vend-nodejs-sdk?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Aims to provides a rich set of client-side functionality for Vend's public APIs

If you don't use nodejs, please be aware that there are still other libraries out there! Hopefully, one that works with your preferred language is already present:

1. https://github.com/pzurek/go-vend
2. https://github.com/ShoppinPal/vend-php-tools
3. https://github.com/chipwillman/VendAPI.Net
4. https://github.com/wso2-extensions/esb-connector-vend

There are also resources for developers by Vend:

1. https://github.com/vend/developer-wiki/wiki
2. http://docs.vend.apiary.io/

Simple-Legal-Speak
==================

This is a labor of love. This effort is not funded, endorsed or sponsored by Vend.

This module is being written out of sheer respect for Vend's uncanny success at platformizing retail with their public API. It will hopefully help democratize access further by adding ease of use for developers. The authors of this module are not Vend employees and Vend didn't ask us to do this. Retail is a tricky/competitive space and we want to help reduce development churn, by open-sourcing pieces that allow folks to build iterative solutions. When in doubt, be sure to pay attention to the details expressed in the LICENSE file.

Who are we?
===========

ShoppinPal is a team of engineers and product guys with background in developing core systems at well-known Silicon Valley companies. We have deep expertise with Vend APIs. Several retailers use our ecommerce add-on, which works beautifully with Vend. We would love to assist you with any custom development needs that help you get the most out of Vend. We are listed in http://www.vendhq.com/expert-directory

Features
========
1. Added sample API call for fetching product
  1. requires nothing more than a subdomain/domain-prefix and basic authN for developers to start experimenting: `NODE_ENV=dev node sample.js`
  2. *always* uses promises instead of callbacks
  3. *handles* 429 response code for rate limiting by retrying as many as 3 times
2. Uses oauth for API calls.

Roadmap
=======

1. Add sample API calls for all the exposed REST endpoints at https://developers.vendhq.com/documentation/api/index.html
2. Code up a plug-&-play or drop-in utility class for OAuth w/ Vend that anyone can add to their workflow.

Usage
=====
```
// this module isn't published to NPM yet, so you have to clone it to the node_modules folder in your machine, beforehand
var vendSdk = require('vend-nodejs-sdk')({}); 

var args = vendSdk.args.products.fetch();
args.orderBy.value = 'id';
args.page.value = 1;
args.pageSize.value = 5;
args.active.value = true;

var connectionInfo = {
  domainPrefix: nconf.get('domain_prefix'),
  accessToken: nconf.get('access_token')
};

vendSdk.products.fetch(args, connectionInfo)
  .then(function(response){
    _.each(response.products, function(product){
      console.log(product.id + ' : ' + product.name);
    });
  });

```

Tests
=====

1. The tests are setup to fail if you haven't taken the steps needed to run them. Hopefully, it will help you pinpoint which of the following steps you forgot, if any.
1. NODE_ENV must be set. There are several ways to do this.
  1. running `npm test` translates to `NODE_ENV=test mocha` so the `NODE_ENV` is already set for you in this case.
  1. if you choose to run `mocha` directly then we advice running it with the `NODE_ENV` set. Examples:
    1. `NODE_ENV=test ./node_modules/.bin/mocha`
    2. `export NODE_ENV=test && ./node_modules/.bin/mocha`
1. `NODE_ENV=test` exists so that while testing, logs are sent only to file. This leaves your console free for unit test status messages and avoids clutter.
  1. If you must absolutely see the additional logs in your console then change the `NODE_ENV` value. For example: `NODE_ENV=dev ./node_modules/.bin/mocha` 
1. Optionally you may set `LOG_LEVEL_FOR_VEND_NODEJS_SDK` to a valid `winston` log level value to control the logs.
1. For `NODE_ENV=test` you must create a file: `config/test.json`
  1. the filename format is `config/<env>.json` so if you change to `NODE_ENV=dev` then the expected filename changes to `config/dev.json`
  1. the file format is as follows and you must substitute the missing values from your own vend setup:

    ```
    {
      "vend":{
        "auth_endpoint":"https://{DOMAIN_PREFIX}.vendhq.com/connect",
        "token_service":"https://{DOMAIN_PREFIX}.vendhq.com/api/1.0/token",
        "client_id":"",
        "client_secret":""
      }
    }
    ```
1. Must create a file: `config/oauth.json`
  1. the file format is as follows and you must substitute the missing values from your own vend setup:

    ```
    {
      "access_token": "",
      "refresh_token": "",
      "domain_prefix": ""
    }
    ```

Contributing
============

1. Feel free to [contribute via PR](https://github.com/ShoppinPal/vend-nodejs-sdk/pulls) or [open an issue](https://github.com/ShoppinPal/vend-nodejs-sdk/issues) for discussion or jump into the [gitter chat room](https://gitter.im/ShoppinPal/vend-nodejs-sdk) if you have ideas.
1. I recommend that project contributors who are part of the team:
  1. should merge `master` into `develop` ... if they are behind, before starting the `feature` branch
  1. should create `feature` branches from the `develop` branch
  1. should merge `feature` into `develop` then create a `release` branch to:
    1. update the changelog
    1. update the readme
    1. fix any bugs from final testing
    1. commit locally and run `npm-release x.x.x -m "<some comment>"`
    1. merge `release` into both `master` and `develop`
    1. push `master` and `develop` to GitHub
1. For those who use forks:
  1. please submit your PR against the `develop` branch, if possible
  1. if you must submit your PR against the `master` branch ... I understand and I can't stop you. I only hope that there is a good reason like `develop` not being up-to-date with `master` for the work you want to build upon.
1. `npm-release <versionNumber> -m <commit message>` may be used to publish. Pubilshing to NPM should happen from the `master` branch. It should ideally only happen when there is something release worthy. There's no point in publishing just because of changes to `test` or `examples` folder or any other such entities that aren't part of the "published module" (refer to `.npmignore`) to begin with.
