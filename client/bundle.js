(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

(function() {
  'use strict';

  /**
   * Export to node for testing and to global for production.
   */

  if (typeof module === 'object' && typeof exports === 'object') {
    module.exports = Connection;
  } else {
    this.Connection = Connection;
  }

  /**
   * Constants.
   */

  var DELAY = 500;
  var RETRIES = 5;
  var NOP = function () {};

  /**
   * Takes care of connecting, messaging, handling connection retries with the
   * flo server.
   *
   * @param {string} host
   * @param {string} port
   * @param {object} logger
   * @class Connection
   * @public
   */

  function Connection(host, port, createLogger) {
    this.retries = RETRIES;
    this.host = host;
    this.port = port;
    this.logger = createLogger('connection');
    this.openHandler = this.openHandler.bind(this);
    this.messageHandler = this.messageHandler.bind(this);
    this.closeHandler = this.closeHandler.bind(this);
  }

  /**
   * Callbacks.
   */

  Connection.prototype.callbacks = {
    connecting: NOP,
    message: NOP,
    error: NOP,
    retry: NOP,
    open: NOP
  };

  /**
   * Connect to host.
   *
   * @public
   * @returns {Connection} this
   */

  Connection.prototype.connect = function() {
    var url = 'ws://' + this.host + ':' + this.port + '/';
    var ws = new WebSocket(url);

    this.callbacks.connecting();
    this.logger.log('Connecting to', url);

    ws.onopen = this.openHandler;
    ws.onmessage = this.messageHandler;
    ws.onclose = this.closeHandler;

    this.ws = ws;
    return this;
  };

  /**
   * Registers a message handler.
   *
   * @param {function} callback
   * @param {object} thisObj
   * @return {Connection} this
   * @public
   */

  Connection.prototype.onmessage = makeCallbackRegistrar('message');

  /**
   * Registers an error handler.
   *
   * @param {function} callback
   * @param {object} thisObj
   * @return {Connection} this
   * @public
   */

  Connection.prototype.onerror = makeCallbackRegistrar('error');

  /**
   * Registers a connection handler.
   *
   * @param {function} callback
   * @param {object} thisObj
   * @return {Connection} this
   * @public
   */

  Connection.prototype.onopen = makeCallbackRegistrar('open');

  /**
   * Registers a retry handler.
   *
   * @param {function} callback
   * @param {object} thisObj
   * @return {Connection} this
   * @public
   */

  Connection.prototype.onretry = makeCallbackRegistrar('retry');

  /**
   * Connecting callback
   *
   * @param {function} callback
   * @param {object} thisObj
   * @return {Connection} this
   * @public
   */

  Connection.prototype.onconnecting = makeCallbackRegistrar('connecting');

  /**
   * Disconnects from the server
   *
   * @param {function} callback
   * @return {Connection} this
   * @public
   */

  Connection.prototype.disconnect = function (callback) {
    callback = callback || NOP;
    if (this.connected()) {
      this.ws.onclose = callback;
      this.ws.close();
    } else {
      callback();
    }
    return this;
  };

  /**
   * Are we connected?
   *
   * @public
   * @return {boolean}
   */

  Connection.prototype.connected = function() {
    return this.ws && this.ws.readyState === this.ws.OPEN;
  };

  /**
   * Message handler.
   *
   * @param {object} evt
   * @private
   */

  Connection.prototype.messageHandler = function(evt) {
    var msg = JSON.parse(evt.data);
    this.callbacks.message(msg);
  };


  /**
   * Open handler.
   *
   * @private
   */

  Connection.prototype.openHandler = function() {
    this.logger.log('Connected');
    this.callbacks.open();
    this.retries = RETRIES;
  };


  /**
   * Retries to connect or emits error.
   *
   * @param {object} evt The event that caused the retry.
   * @private
   */

  Connection.prototype.closeHandler = function(evt) {
    this.logger.error('Failed to connect with', evt.reason, evt.code);
    this.retries -= 1;
    if (this.retries < 1) {
      var err = new Error(evt.reason || 'Error connecting.');
      this.callbacks.error(err);
    } else {
      var delay = (RETRIES - this.retries) * DELAY;
      this.logger.log('Reconnecting in ', delay);
      this.callbacks.retry(delay);
      setTimeout(function () {
        this.connect();
      }.bind(this), delay);
    }
  };

  /**
   * Creates a function that registers an event listener when called.
   *
   * @param {string} name
   * @return {function}
   * @private
   */

  function makeCallbackRegistrar(name) {
    return function(cb, context) {
      this.callbacks[name] = cb.bind(context || null);
      return this;
    };
  }

}).call(this);

},{}],2:[function(require,module,exports){
/**
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/* jshint evil:true */

this.Logger = (function() {
  'use strict';

  function Logger(log) {
    return function(namespace) {
      return {
        error: createLogLevel('error'),
        log: createLogLevel('log')
      };

      function createLogLevel(level) {
        return function () {
          var args = [].slice.call(arguments);
          args[0] = '[' + namespace + '] ' + args[0];
          return log([level, args]);
        };
      }
    };
  }

  Logger.logInContext = function(arg, method) {
    if (!method) {
      method = 'log';
    }
    chrome.devtools.inspectedWindow['eval'](
      'console.' + method + '("' + arg.toString() + '")'
    );
  };

  return Logger;
})();

},{}],3:[function(require,module,exports){
/**
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/*global Connection:false */

(function () {
  'use strict';

  /**
   * Export to Node for testing and to global for production.
   */

  if (typeof module === 'object' && typeof exports === 'object') {
    module.exports = Session;
  } else {
    this.Session = Session;
  }

  /**
   * Manages a user sessios.
   *
   * @param {string} host
   * @param {number} port
   * @param {function} status
   * @param {function} logger
   * @class Session
   * @public
   */

  function Session(host, port, status, createLogger) {
    this.host = host;
    this.port = port;
    this.status = status;
    this.createLogger = createLogger;
    this.logger = createLogger('session');
    this.resources = null;
    this.conn = null;
    this.listeners = {};
    this.messageHandler = this.messageHandler.bind(this);
    this.started = this.started.bind(this);
  }

  /**
   * Registers the resources, connects to server and listens to events.
   *
   * @public
   */

  Session.prototype.start = function() {
    this.logger.log('Starting flo for host', this.host);
    this.getResources(this.connect.bind(this, this.started));
  };

  /**
   * Similar to restart but does only what's needed to get flo started.
   *
   * @public
   */

  Session.prototype.restart = function() {
    this.logger.log('Restarting');
    this.removeEventListeners();
    if (this.conn.connected()) {
      // No need to reconnect. We just refetch the resources.
      this.getResources(this.started.bind(this));
    } else {
      this.start();
    }
  };

  /**
   * This method takes care of listening to events defined by the chrome api
   * @see http://developer.chrome.com/extensions/events
   * We also keep an internal map of events we're listening to so we can
   * unsubscribe in the future.
   *
   * @param {object} object
   * @param {string} event
   * @param {function} listener
   * @private
   */

  Session.prototype.listen = function(obj, event, listener) {
    listener = listener.bind(this);
    obj[event].addListener(listener);
    this.listeners[event] = {
      obj: obj,
      listener: listener
    };
  };


  /**
   * Remove all event listeners.
   *
   * @private
   */

  Session.prototype.removeEventListeners = function() {
    Object.keys(this.listeners).forEach(function(event) {
      var desc = this.listeners[event];
      desc.obj[event].removeListener(desc.listener);
    }, this);
  };

  /**
   * Registers the resources and listens to onResourceAdded events.
   *
   * @param {function} callback
   * @private
   */

  Session.prototype.getResources = function(callback) {
    var self = this;
    chrome.devtools.inspectedWindow.getResources(function (resources) {
      self.resources = resources;
      // After we register the current resources, we listen to the
      // onResourceAdded event to push on more resources lazily fetched
      // to our array.
      self.listen(
        chrome.devtools.inspectedWindow,
        'onResourceAdded',
        function (res) {
          self.resources.push(res);
        }
      );
      callback();
    });
  };

  /**
   * Connect to server.
   *
   * @param {function} callback
   * @private
   */

  Session.prototype.connect = function(callback) {
    callback = once(callback);
    var self = this;
    this.conn = new Connection(this.host, this.port, this.createLogger)
      .onmessage(this.messageHandler)
      .onerror(function () {
        self.status('error');
      })
      .onopen(function () {
        self.status('connected');
        callback();
      })
      .onretry(function(delay) {
        self.status('retry', delay);
      })
      .onconnecting(function() {
        self.status('connecting');
      })
      .connect();
  };

  /**
   * Does whatever needs to be done after the session is started. Currenlty
   * just listening to page refresh events.
   *
   * @param {function} callback
   */

  Session.prototype.started = function() {
    this.logger.log('Started');
    this.status('started');
    this.listen(
      chrome.devtools.network,
      'onNavigated',
      this.restart
    );
  };

  /**
   * Handler for messages from the server.
   *
   * @param {object} updatedResource
   * @private
   */

  Session.prototype.messageHandler = function(updatedResource) {
    this.logger.log('Requested resource update', updatedResource.resourceURL);

    if (updatedResource.reload) {
      chrome.devtools.inspectedWindow.reload();
      return;
    }

    var match = updatedResource.match;
    var matcher;

    if (typeof match === 'string') {
      if (match === 'indexOf') {
        matcher = indexOfMatcher;
      } else if (match === 'equal') {
        matcher = equalMatcher;
      } else {
        this.logger.error('Unknown match string option', match);
        return;
      }
    } else if (match && typeof match === 'object') {
      if (match.type === 'regexp') {
        var flags = '';
        if (match.ignoreCase) {
          flags += 'i';
        }
        if (match.multiline) {
          flags += 'm';
        }
        if (match.global) {
          flags += 'g';
        }
        var r = new RegExp(match.source, flags);
        matcher = r.exec.bind(r);
      } else {
        this.logger.error('Unknown matcher object:', match);
        return;
      }
    }

    var resource = this.resources.filter(function (res) {
      return matcher(res.url, updatedResource.resourceURL);
    })[0];

    if (!resource) {
      this.logger.error(
        'Resource with the following URL is not on the page:',
        updatedResource.resourceURL
      );
      return;
    }

    resource.setContent(updatedResource.contents, true, function (status) {
      if (status.code === 'OK') {
        this.logger.log('Resource update successful');
        triggerReloadEvent(updatedResource);
      } else {
        this.logger.error(
          'flo failed to update, this shouldn\'t happen please report it: ' +
            JSON.stringify(status)
        );
      }
    }.bind(this));
  };

  /**
   * Destroys session.
   *
   * @public
   */

  Session.prototype.destroy = function() {
    this.removeEventListeners();
    if (this.conn) this.conn.disconnect();
  };

  /**
   * Utility to ensure's a function is called only once.
   *
   * @param {function} cb
   * @private
   */

  function once(cb) {
    var called = false;
    return function() {
      if (!called) {
        called = true;
        return cb.apply(this, arguments);
      }
    };
  }

  function triggerReloadEvent(resource) {
    var data = {
      url: resource.resourceURL,
      contents: resource.contents
    };

    if ('string' === typeof resource.update) {
      var updateFnStr = '(function() {' +
        'try {' +
          '(' + resource.update + ')(window, ' + JSON.stringify(resource.resourceURL) + ');' +
          '} catch(ex) {' +
            'console.error("There was an error while evaluating the fb-flo update function. ' +
            'Please check the function\'s code and review the README guidelines regarding it!", ex);' +
          '}' +
        '})()';
        chrome.devtools.inspectedWindow.eval(updateFnStr);
    }

    var script = '(function() {' +
      'var event = new Event(\'fb-flo-reload\');' +
      'event.data = ' + JSON.stringify(data) + ';' +
      'window.dispatchEvent(event);' +
      '})()';

    chrome.devtools.inspectedWindow.eval(script);
  }

  function indexOfMatcher(val, resourceURL) {
    return val.indexOf(resourceURL) > -1;
  }

  function equalMatcher(val, resourceURL) {
    return resourceURL === val;
  }

}).call(this);

},{}],4:[function(require,module,exports){
var _global = (function() { return this; })();


/**
 * W3CWebSocket constructor.
 */
var W3CWebSocket = _global.WebSocket || _global.MozWebSocket;


/**
 * Module exports.
 */
module.exports = {
    'w3cwebsocket' : W3CWebSocket ? W3CWebSocket : null,
    'version'      : require('./version')
};

},{"./version":5}],5:[function(require,module,exports){
module.exports = require('../package.json').version;

},{"../package.json":6}],6:[function(require,module,exports){
module.exports={
  "name": "websocket",
  "description": "Websocket Client & Server Library implementing the WebSocket protocol as specified in RFC 6455.",
  "keywords": [
    "websocket",
    "websockets",
    "socket",
    "networking",
    "comet",
    "push",
    "RFC-6455",
    "realtime",
    "server",
    "client"
  ],
  "author": {
    "name": "Brian McKelvey",
    "email": "brian@worlize.com",
    "url": "https://www.worlize.com/"
  },
  "version": "1.0.13",
  "repository": {
    "type": "git",
    "url": "https://github.com/theturtle32/WebSocket-Node.git"
  },
  "homepage": "https://github.com/theturtle32/WebSocket-Node",
  "engines": {
    "node": ">=0.8.0"
  },
  "dependencies": {
    "debug": "~2.1.0",
    "nan": "~1.0.0",
    "typedarray-to-buffer": "~3.0.0"
  },
  "devDependencies": {
    "faucet": "0.0.1",
    "gulp": "git+https://github.com/gulpjs/gulp.git#4.0",
    "gulp-jshint": "^1.9.0",
    "jshint-stylish": "^1.0.0",
    "tape": "^3.0.0"
  },
  "config": {
    "verbose": false
  },
  "scripts": {
    "install": "(node-gyp rebuild 2> builderror.log) || (exit 0)",
    "test": "faucet test/unit",
    "gulp": "gulp"
  },
  "main": "index",
  "directories": {
    "lib": "./lib"
  },
  "browser": "lib/browser.js",
  "readme": "WebSocket Client & Server Implementation for Node\n=================================================\n\n[![npm version](https://badge.fury.io/js/websocket.svg)](http://badge.fury.io/js/websocket)\n\n[![NPM](https://nodei.co/npm/websocket.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/websocket/)\n\n[![NPM](https://nodei.co/npm-dl/websocket.png?height=3)](https://nodei.co/npm/websocket/)\n\nOverview\n--------\nThis is a (mostly) pure JavaScript implementation of the WebSocket protocol versions 8 and 13 for Node.  There are some example client and server applications that implement various interoperability testing protocols in the \"test/scripts\" folder.\n\nFor a WebSocket client written in ActionScript 3, see my [AS3WebScocket](https://github.com/theturtle32/AS3WebSocket) project.\n\n\nDocumentation\n=============\n\n[You can read the full API documentation in the docs folder.](docs/index.md)\n\n\nChangelog\n---------\n\n***Current Version: 1.0.13*** — Released 2014-11-29\n\n***Version 1.0.13***\n\n* Fixes [issue #171](https://github.com/theturtle32/WebSocket-Node/issues/171) - Code to prevent calling req.accept/req.reject multiple times breaks sanity checks in req.accept\n\n\n***Version 1.0.12***\n\n* Fixes [issue #170](https://github.com/theturtle32/WebSocket-Node/issues/170) - Non-native XOR implementation broken after making JSHint happy\n\n\n***Version 1.0.11***\n\n* Fixes some undefined behavior surrounding closing WebSocket connections and more reliably handles edge cases.\n* Adds an implementation of the W3C WebSocket API for browsers to facilitate sharing code between client and server via browserify. (Thanks, [@ibc](https://github.com/ibc)!)\n* `WebSocketConnection.prototype.close` now accepts optional `reasonCode` and `description` parameters.\n* Calling `accept` or `reject` more than once on a `WebSocketRequest` instance will now throw an error.  [Issue #149](https://github.com/theturtle32/WebSocket-Node/issues/149)\n* Handling connections dropped by client before accepted by server [Issue #167](https://github.com/theturtle32/WebSocket-Node/issues/167)\n* Integrating Gulp and JSHint (Thanks, [@ibc](https://github.com/ibc)!)\n* Starting to add individual unit tests (using substack's [tape](github.com/substack/tape) and [faucet](github.com/substack/faucet))\n\n[View the full changelog](CHANGELOG.md)\n\nBrowser Support\n---------------\n\nAll current browsers are fully supported.\n\n* Firefox 7-9 (Old) (Protocol Version 8)\n* Firefox 10+ (Protocol Version 13)\n* Chrome 14,15 (Old) (Protocol Version 8)\n* Chrome 16+ (Protocol Version 13)\n* Internet Explorer 10+ (Protocol Version 13)\n* Safari 6+ (Protocol Version 13)\n\n***Safari older than 6.0 is not supported since it uses a very old draft of WebSockets***\n\n***If you need to simultaneously support legacy browser versions that had implemented draft-75/draft-76/draft-00, take a look here: https://gist.github.com/1428579***\n\nBenchmarks\n----------\nThere are some basic benchmarking sections in the Autobahn test suite.  I've put up a [benchmark page](http://theturtle32.github.com/WebSocket-Node/benchmarks/) that shows the results from the Autobahn tests run against AutobahnServer 0.4.10, WebSocket-Node 1.0.2, WebSocket-Node 1.0.4, and ws 0.3.4.\n\nAutobahn Tests\n--------------\nThe very complete [Autobahn Test Suite](http://autobahn.ws/testsuite/) is used by most WebSocket implementations to test spec compliance and interoperability.\n\n- [View Server Test Results](http://theturtle32.github.com/WebSocket-Node/test-report/servers/)\n- [View Client Test Results](http://theturtle32.github.com/WebSocket-Node/test-report/clients/)\n\nNotes\n-----\nThis library has been used in production on [worlize.com](https://www.worlize.com) since April 2011 and seems to be stable.  Your mileage may vary.\n\n**Tested with the following node versions:**\n\n- 0.8.28\n- 0.10.33\n\nIt may work in earlier or later versions but I'm not actively testing it outside of the listed versions.  YMMV.\n\nInstallation\n------------\n\nA few users have reported difficulties building the native extensions without first manually installing node-gyp.  If you have trouble building the native extensions, make sure you've got a C++ compiler, and have done `npm install -g node-gyp` first. \n\nNative extensions are optional, however, and WebSocket-Node will work even if the extensions cannot be compiled.\n\nIn your project root:\n\n    $ npm install websocket\n  \nThen in your code:\n\n```javascript\nvar WebSocketServer = require('websocket').server;\nvar WebSocketClient = require('websocket').client;\nvar WebSocketFrame  = require('websocket').frame;\nvar WebSocketRouter = require('websocket').router;\nvar W3CWebSocket = require('websocket').w3cwebsocket;\n```\n\nNote for Windows Users\n----------------------\nBecause there is a small C++ component used for validating UTF-8 data, you will need to install a few other software packages in addition to Node to be able to build this module:\n\n- [Microsoft Visual C++](http://www.microsoft.com/visualstudio/en-us/products/2010-editions/visual-cpp-express)\n- [Python 2.7](http://www.python.org/download/) (NOT Python 3.x)\n\n\nCurrent Features:\n-----------------\n- Licensed under the Apache License, Version 2.0\n- Protocol version \"8\" and \"13\" (Draft-08 through the final RFC) framing and handshake\n- Can handle/aggregate received fragmented messages\n- Can fragment outgoing messages\n- Router to mount multiple applications to various path and protocol combinations\n- TLS supported for outbound connections via WebSocketClient\n- TLS supported for server connections (use https.createServer instead of http.createServer)\n  - Thanks to [pors](https://github.com/pors) for confirming this!\n- Cookie setting and parsing\n- Tunable settings\n  - Max Receivable Frame Size\n  - Max Aggregate ReceivedMessage Size\n  - Whether to fragment outgoing messages\n  - Fragmentation chunk size for outgoing messages\n  - Whether to automatically send ping frames for the purposes of keepalive\n  - Keep-alive ping interval\n  - Whether or not to automatically assemble received fragments (allows application to handle individual fragments directly)\n  - How long to wait after sending a close frame for acknowledgment before closing the socket.\n- [W3C WebSocket API](http://www.w3.org/TR/websockets/) for applications running on both Node and browsers (via the `W3CWebSocket` class). \n\n\nKnown Issues/Missing Features:\n------------------------------\n- No API for user-provided protocol extensions.\n\n\nUsage Examples\n==============\n\nServer Example\n--------------\n\nHere's a short example showing a server that echos back anything sent to it, whether utf-8 or binary.\n\n```javascript\n#!/usr/bin/env node\nvar WebSocketServer = require('websocket').server;\nvar http = require('http');\n\nvar server = http.createServer(function(request, response) {\n    console.log((new Date()) + ' Received request for ' + request.url);\n    response.writeHead(404);\n    response.end();\n});\nserver.listen(8080, function() {\n    console.log((new Date()) + ' Server is listening on port 8080');\n});\n\nwsServer = new WebSocketServer({\n    httpServer: server,\n    // You should not use autoAcceptConnections for production\n    // applications, as it defeats all standard cross-origin protection\n    // facilities built into the protocol and the browser.  You should\n    // *always* verify the connection's origin and decide whether or not\n    // to accept it.\n    autoAcceptConnections: false\n});\n\nfunction originIsAllowed(origin) {\n  // put logic here to detect whether the specified origin is allowed.\n  return true;\n}\n\nwsServer.on('request', function(request) {\n    if (!originIsAllowed(request.origin)) {\n      // Make sure we only accept requests from an allowed origin\n      request.reject();\n      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');\n      return;\n    }\n    \n    var connection = request.accept('echo-protocol', request.origin);\n    console.log((new Date()) + ' Connection accepted.');\n    connection.on('message', function(message) {\n        if (message.type === 'utf8') {\n            console.log('Received Message: ' + message.utf8Data);\n            connection.sendUTF(message.utf8Data);\n        }\n        else if (message.type === 'binary') {\n            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');\n            connection.sendBytes(message.binaryData);\n        }\n    });\n    connection.on('close', function(reasonCode, description) {\n        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');\n    });\n});\n```\n\nClient Example\n--------------\n\nThis is a simple example client that will print out any utf-8 messages it receives on the console, and periodically sends a random number.\n\n*This code demonstrates a client in Node.js, not in the browser*\n\n```javascript\n#!/usr/bin/env node\nvar WebSocketClient = require('websocket').client;\n\nvar client = new WebSocketClient();\n\nclient.on('connectFailed', function(error) {\n    console.log('Connect Error: ' + error.toString());\n});\n\nclient.on('connect', function(connection) {\n    console.log('WebSocket Client Connected');\n    connection.on('error', function(error) {\n        console.log(\"Connection Error: \" + error.toString());\n    });\n    connection.on('close', function() {\n        console.log('echo-protocol Connection Closed');\n    });\n    connection.on('message', function(message) {\n        if (message.type === 'utf8') {\n            console.log(\"Received: '\" + message.utf8Data + \"'\");\n        }\n    });\n    \n    function sendNumber() {\n        if (connection.connected) {\n            var number = Math.round(Math.random() * 0xFFFFFF);\n            connection.sendUTF(number.toString());\n            setTimeout(sendNumber, 1000);\n        }\n    }\n    sendNumber();\n});\n\nclient.connect('ws://localhost:8080/', 'echo-protocol');\n```\n\nClient Example using the *W3C WebSocket API*\n--------------------------------------------\n\nSame example as above but using the [W3C WebSocket API](http://www.w3.org/TR/websockets/).\n\n```javascript\nvar W3CWebSocket = require('websocket').w3cwebsocket;\n\nvar client = new W3CWebSocket('ws://localhost:8080/', 'echo-protocol');\n\nclient.onerror = function() {\n    console.log('Connection Error');\n};\n\nclient.onopen = function() {\n    console.log('WebSocket Client Connected');\n\n    function sendNumber() {\n        if (client.readyState === client.OPEN) {\n            var number = Math.round(Math.random() * 0xFFFFFF);\n            client.send(number.toString());\n            setTimeout(sendNumber, 1000);\n        }\n    }\n    sendNumber();\n};\n\nclient.onclose = function() {\n    console.log('echo-protocol Client Closed');\n};\n\nclient.onmessage = function(e) {\n    if (typeof e.data === 'string') {\n        console.log(\"Received: '\" + e.data + \"'\");\n    }\n};\n```\n    \nRequest Router Example\n----------------------\n\nFor an example of using the request router, see `libwebsockets-test-server.js` in the `test` folder.\n\n\nResources\n---------\n\nA presentation on the state of the WebSockets protocol that I gave on July 23, 2011 at the LA Hacker News meetup.  [WebSockets: The Real-Time Web, Delivered](http://www.scribd.com/doc/60898569/WebSockets-The-Real-Time-Web-Delivered)\n",
  "readmeFilename": "README.md",
  "bugs": {
    "url": "https://github.com/theturtle32/WebSocket-Node/issues"
  },
  "_id": "websocket@1.0.13",
  "_from": "websocket@~1.0.8"
}

},{}],7:[function(require,module,exports){
/**
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var WebSocketClient = require('websocket').client;

function WebSocket(url) {
  this.readyState = 0;
  var client = new WebSocketClient();
  this.onconnect = this.onconnect.bind(this);
  client.once('connect', this.onconnect);
  client.once('connectFailed', this.emit.bind(this, 'close'));
  client.connect(url);
}

WebSocket.prototype.onconnect = function(connection) {
  this.readyState = 1;
  this.socket = connection;
  this.socket.on('error', this.emit.bind(this, 'close'));
  this.socket.on('close', function() {
    this.readyState = 3;
    this.emit('close', {});
  }.bind(this));
  this.socket.on('message', function(msg) {
    var data = msg.utf8Data;
    this.emit('message', {data: data});
  }.bind(this));
  this.emit('open');
};

WebSocket.prototype.send = function(arg) {
  this.socket.sendUTF(arg);
};

WebSocket.prototype.close = function() {
  this.readyState = 2;
  this.socket.close();
};

WebSocket.prototype.emit = function(event) {
  var handler = this['on' + event];
  if (typeof handler === 'function') {
    handler.apply(this, [].slice.call(arguments, 1));
  }
};

var states = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

Object.keys(states).forEach(function(state) {
  WebSocket.prototype[state] = states[state];
});

module.exports = WebSocket;

},{"websocket":4}],8:[function(require,module,exports){
(function (global){
/**
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/* jshint evil:false */
/* global chrome:true */

var Logger = require('fb-flo/client/logger');
var Connection = require('fb-flo/client/connection');
var Session = require('fb-flo/client/session');
var WebSocket = require('fb-flo/test/client/browser_websocket');

var fix = global || window;
fix.Connection = Connection;
fix.WebSocket = WebSocket;

(function() {
  'use strict';

  /**
   * Constants
   */

  var FLO_CONFIG_KEY = 'flo-config';

  /**
   * Flo client controller.
   *
   * @class FloClient
   * @private
   */

  function FloClient() {
    var self = this;
    loadConfig(function (config) {
      self.config = config;
      self.session = null;
      self.panelWindow = null;
      self.panelEventBuffer = [];
      self.status = self.status.bind(self);
      self.startNewSession = self.startNewSession.bind(self);
      self.createLogger = Logger(self.triggerEvent.bind(self, 'log'));
      self.loggger = self.createLogger('flo');
      self.createPanel();
      self.start();
    });
  }

  /**
   * Save current config to disk.
   *
   * @param {object} config
   * @private
   */

  FloClient.prototype.saveConfig = function() {
    saveConfig(this.config);
  };

  /**
   * Listen on the panel window for an event `type`, i.e. receive a message
   * from the panel.
   *
   * @param {string} type
   * @param {function} callback
   * @private
   */

  FloClient.prototype.listenToPanel = function(type, callback) {
    if (!this.panelWindow) {
      throw new Error('Panel not found');
    }
    this.panelWindow.addEventListener('flo_' + type, callback.bind(this));
  };

  /**
   * Trigger an event on the panel window, i.e. send a message to the panel.
   * If the panel wasn't instantiated yet, the event is buffered.
   *
   * @param {string} type
   * @param {object} data
   * @private
   */

  FloClient.prototype.triggerEvent = function(type, data) {
    var event = new Event('flo_' + type);
    event.data = data;
    // Save events for anytime we need to reinit the panel with prev state.
    this.panelEventBuffer.push(event);
    if (this.panelWindow) {
      this.panelWindow.dispatchEvent(event);
    }
    return event;
  };

  /**
   * Create a new panel.
   *
   * @param {function} callback
   * @private
   */

  FloClient.prototype.createPanel = function(callback) {
    var self = this;
    chrome.devtools.panels.create(
      'flo',
      '',
      'configure/configure.html',
      function (panel) {
        panel.onShown.addListener(function(panelWindow) {
          if (!panelWindow.wasShown) {
            self.panelWindow = panelWindow;
            self.initPanel();
            panelWindow.wasShown = true;
          }
        });
      }
    );
  };

  /**
   * Called after the panel is first created to listen on it's events.
   * Will also trigger all buffered events on the panel.
   *
   * @param {object} config
   * @private
   */

  FloClient.prototype.initPanel = function() {
    this.listenToPanel('config_changed', function(e) {
      this.config = e.data;
      this.saveConfig();
      this.startNewSession();
    });
    this.listenToPanel('retry', this.startNewSession);
    this.listenToPanel('enable_for_host', this.enableForHost);
    this.panelEventBuffer.forEach(function(event) {
      this.panelWindow.dispatchEvent(event);
    }, this);
    this.triggerEvent('load', this.config);
  };

  /**
   * Starts the flo client.
   *
   * @private
   */

  FloClient.prototype.start = function() {
    this.status('starting');
    this.startNewSession();
  };


  /**
   * Stops flo client.
   *
   * @private
   */

  FloClient.prototype.stop = function() {
    this.session.destroy();
    this.session = null;
  };

  /**
   * Get the url location of the inspected window.
   *
   * @param {function} callback
   * @private
   */

  FloClient.prototype.getLocation = function(callback) {
    chrome.devtools.inspectedWindow['eval'](
      'location.hostname || location.href',
      callback.bind(this)
    );
  };

  /**
   * Match config patterns against `host` and returns the matched site record.
   *
   * @param {string} host
   * @return {object|null}
   * @private
   */

  FloClient.prototype.getSite = function(host) {
    var config = this.config;
    for (var i = 0; i < config.sites.length; i++) {
      var site = config.sites[i];
      var pattern = parsePattern(site.pattern);
      var matched = false;
      if (pattern instanceof RegExp) {
        matched = pattern.exec(host);
      } else {
        matched = pattern === host;
      }
      if (matched) return site;
    }
    return null;
  };

  /**
   * Instantiates a new `session`.
   *
   * @private
   */

  FloClient.prototype.startNewSession = function() {
    if (this.session) {
      this.stop();
    }

    this.getLocation(
      function (host) {
        var site = this.getSite(host);
        if (site) {
          this.session = new Session(
            site.server || host,
            site.port || this.config.port,
            this.status,
            this.createLogger
          );
          this.session.start();
        } else {
          this.status('disabled');
        }
      }
    );
  };

  /**
   * Enables flo for the current inspected window host.
   *
   * @private
   */

  FloClient.prototype.enableForHost = function() {
    this.getLocation(function(host) {
      if (!this.getSite(host)) {
        this.config.sites.push({
          pattern: host,
          server: host
        });
        this.saveConfig();
        this.triggerEvent('load', this.config);
        this.startNewSession();
      }
    });
  };

  /**
   * Reports status changes to panel.
   *
   * @param {string} status
   * @param {object} aux
   * @private
   */

  FloClient.prototype.status = function(status, aux) {
    var text, action;
    switch (status) {
      case 'starting':
        text = 'Starting';
        break;
      case 'disabled':
        text = 'Disabled for this site';
        action = 'enable';
        break;
      case 'connecting':
        text = 'Connecting';
        break;
      case 'connected':
        text = 'Connected';
        break;
      case 'started':
        text = 'Started';
        break;
      case 'retry':
        text = 'Failed to connect, retrying in ' + (aux / 1000) + 's';
        break;
      case 'error':
        text = 'Error connecting';
        action = 'retry';
        break;
      default:
        throw new Error('Unknown session status.');
    }

    this.triggerEvent('status_change', {
      type: status,
      text: text,
      action: action
    });
  };

  /**
   * Save passed in config object to disk.
   *
   * @param {object} config
   * @private
   */

  function saveConfig(config) {
    chrome.runtime.sendMessage({
      name: 'localStorage:set',
      key: FLO_CONFIG_KEY,
      data: JSON.stringify(config)
    });
  }

  /**
   * Loads config from storage.
   *
   * @param {function} done
   * @private
   */

  function loadConfig(done) {
    chrome.runtime.sendMessage(
      {
        name : 'localStorage:get',
        key : FLO_CONFIG_KEY
      },
      function (configJSON){
        var config = parseConfig(configJSON);
        done(config);
      }
    );
  }

  /**
   * Parses config and sets sensible defaults.
   *
   * @param {string} config
   * @param {}
   * @private
   */

  function parseConfig(configJSON) {
    var config;

    try {
      config = JSON.parse(configJSON);
    }
    catch (ex) {
      config = {};
    }

    config.sites = config.sites || [];
    config.port = config.port || 8888;

    return config;
  }

  /**
   * Optionally parses config from JSON to an object.
   * Also, parses patterns into regexp.
   *
   * @private
   * @return {object}
   */

  function parsePattern(pattern) {
    if (!pattern) return null;
    var m = pattern.match(/^\/(.+)\/([gim]{0,3})$/);
    if (m && m[1]) {
      return new RegExp(m[1], m[2]);
    }
    return pattern;
  }

  // Start the app.
  new FloClient();

})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"fb-flo/client/connection":1,"fb-flo/client/logger":2,"fb-flo/client/session":3,"fb-flo/test/client/browser_websocket":7}]},{},[8]);
