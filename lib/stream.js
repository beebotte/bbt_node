"use strict";

var events = require('events')
  , util = require('util')
  , Subscription = require('./subscription');
  
function nop( ) {}

/** @constructor 
 * Stream Constructor
 * 
 * @param {Object} [options] - Stream connection options
 */
function Stream(options) {
  //check options
  if ( !options ) throw new Error('Initialization error: missing transport options');

  this._initDefaults(); //Initialize default params
  this._updateParams(options);

  var self = this;

  self.on('error', nop);
  
  this.subscriptions = [];

  this.getSubscriptions = function () { return this.subscriptions; }
  
  this.addSubscription = function(args, callback) {
    var c = new Subscription(args, callback, this);
    this.subscriptions[c.eid] = c;
    return c;
  }

  this.getSubscription = function(channel, resource) {
    if(this.subscriptions[channel + this.seperator + resource]) return this.subscriptions[channel + this.seperator + resource];
    return null;
  }

  this.getAnySubscription = function(channel, resource) {
    if(this.subscriptions[channel + this.seperator + resource]) return this.subscriptions[channel + this.seperator + resource];
    else if(this.subscriptions[channel + this.seperator + this.wildcard]) return this.subscriptions[channel + this.seperator + this.wildcard];
    return null;
  }

  this.removeSubscription = function(channel, resource) {
    resource = resource || '*';
    if(this.subscriptions[channel + this.seperator + resource]) {
      var retval = this.subscriptions[channel + this.seperator + resource];
      delete this.subscriptions[channel + this.seperator + resource];
      return retval;
    } 
    return null;
  }

  this.getSubscriptionWithPermission = function(channel, resource, read, write) {
    var Subscription = null;
    var match = false;
    if(Subscription = this.subscriptions[channel + this.seperator + resource]) {
      match = true;
      if(read) match = Subscription.hasReadPermission();
      if(write) match = Subscription.hasWritePermission();
      if(match) return Subscription;
    }else if(Subscription = this.subscriptions[channel + this.seperator + this.wildcard]) {
      match = true;
      if(read) match = Subscription.hasReadPermission();
      if(write) match = Subscription.hasWritePermission();
      if(match) return Subscription;
    }
    return null;
  }

  this._initTransport(options.transport);
  
  this.connection = new this.ConnectionFactory(this);
  this.connect();
}

util.inherits(Stream, events.EventEmitter);

/*** Constant Values ***/
Stream.PROTO      = 1; //Version of Beebotte Protocol
Stream.ws_host    = 'ws.beebotte.com';
Stream.mqtt_host  = 'mqtt.beebotte.com';
Stream.host       = 'beebotte.com';
Stream.port       = 80;  //Port for clear text connections
Stream.sport      = 443; //Port for secure (TLS) connections

/**
 * _initDefaults - initialize with default parameters
 *
 * @api private
 **/
Stream.prototype._initDefaults = function() {
  this.cipher = null;
  this.userinfo = {};
  this.seperator = '.';
  this.wildcard = '*';
}

/**
 * _initTransport - initialize transport for this stream connection
 * @param {Object} [transport] - transport parameters
 *
 * @api private
 **/
Stream.prototype._initTransport = function(transport) {
  this.transport = {};
  
  if( transport.type === 'socketio' ) return this._initSocketioTransport(transport);
  else if( transport.type === 'mqtt' ) return this._initMqttTransport(transport);
  else throw new Error('Initialization error: unrecognized transport protocol');
}

/**
 * _initSocketioTransport - initialize Socket.io transport for this stream connection
 * @param {Object} [transport] - Socket.io transport parameters
 *
 * @api private
 **/
Stream.prototype._initSocketioTransport = function(transport) {
  this.transport = {};
  this.transport.key = transport.key || transport.apiKey;
  
  if( !this.transport.key && !transport.token ) throw new Error('Initialization error: missing API AccessKey or Channel Token');
  
  this.seperator = '.';
  this.wildcard = '*';

  this.ConnectionFactory = require('./socketio');

  this.transport.ws_host  = Stream.ws_host;
  this.transport.host     = Stream.host;
  this.transport.port     = Stream.port;
  this.transport.sport    = Stream.sport;

  this.transport.ssl = true;
  this.transport.auth_endpoint = null;
  this.transport.auth_method = 'get';

  // If the Secret Key is provided, no need for external authentication endpoint!
  if(transport.secretKey) {
    this.transport.secretKey = transport.secretKey;
    // if secretKey is provided; defaults to function based auth.  
    this.transport.auth_method = 'fct';
  } else if(transport.token) {
    this.transport.token = transport.token;
    // if Channel Token is provided; defaults to function based auth.
    this.transport.auth_method = 'fct';
  } else {
    if(transport.auth_endpoint) this.transport.auth_endpoint = transport.auth_endpoint;
    if(transport.auth_method) this.transport.auth_method = transport.auth_method;
  }
  if(transport.host) this.transport.host = transport.host;
  if(transport.ws_host) this.transport.ws_host = transport.ws_host;
  if(transport.port) this.transport.port = transport.port;
  if(transport.sport) this.transport.sport = transport.sport;
  if(transport.ssl === false) this.transport.ssl = transport.ssl; //set to false
}

/**
 * _initMqttTransport - initialize MQTT transport for this stream connection
 * @param {Object} [transport] - MQTT transport parameters
 *
 * @api private
 **/
Stream.prototype._initMqttTransport = function(transport) {
  this.transport = {};
  
  this.seperator = '/';
  this.wildcard = '#';
  this.transport = transport;

  this.ConnectionFactory = require('./mqtt');

  if( transport.apiKey && transport.secretKey && transport.username ) {
    transport.authMethod = 'signature'
  } else if ( transport.secretKey ) {
    transport.authMethod = 'secretKey'
  } else if ( transport.token ) {
    transport.authMethod = 'token'
  }

  this.transport.mqtt_host = transport.mqtt_host || Stream.mqtt_host;
  //default to encrypted transport
  this.transport.ssl       = (transport.ssl === false)? false : true;
  if( !transport.port ) this.transport.port = (this.transport.ssl === false)? 1883 : 8883;
}

/**
 * _updateParams - update connection parameters
 *
 * @api private
 **/
Stream.prototype._updateParams = function(params) {
  if(params.userinfo) this.userinfo = params.userinfo;
  if(params.username) this.userinfo.username = params.username;

  if(params.cipher) this.cipher = params.cipher;
}

/**
 * setUsername - associate a friendly username with this stream connection.
 * This method MAY only be called before any subscription is made otherwise
 * it will be ignored.
 *
 * @returns {Stream} this - for chaining
 * 
 * @api public
 **/
Stream.prototype.setUsername = function(username) {
  this.userinfo.username = username;
  return this;
}

/**
 * setUserid - associate a userid with this stream connection.
 * This method MAY only be called before any subscription is made. 
 *
 * @returns {Stream} this - for chaining
 *
 * @api public
 **/
Stream.prototype.setUserid = function(userid) {
  this.userinfo.userid = userid;
  return this;
}

/**
 * connect - connect this stream. This method will be automatically called on stream creation.
 *
 * @returns {Stream} this - for chaining
 * 
 * @api public
 * 
 * @example stream.connect();
 */
Stream.prototype.connect = function() {
  return this.connection.connect();
}

/**
 * disconnect - disconnect this stream.
 * 
 * @api public
 * 
 * @example stream.disconnect();
 */
Stream.prototype.disconnect = function() {
  return this.connection.disconnect();
}

/**
 * publish - publish <data> to topic defined by <channel> and <resource>
 * 
 * @param {String} channel - channel to publish to
 * @param {String} resource - resource to publish to
 * @param {Object} data - data to publish
 * @param {Object} [args] - publish options
 * 
 * @returns {Stream} this - for chaining
 * 
 * @api public
 * 
 * @example stream.publish('channel', 'resource', 'Hello World');
 */
Stream.prototype.publish = function(channel, resource, data, args) {
  var vargs = {};
  vargs.channel = channel;
  vargs.resource = resource;
  vargs.data = data;
  
  if(!args) args = {};
  
  if( typeof vargs.channel !== 'string')
    throw new Error('Publish: Invalid format, channel must be a string');

  if( typeof vargs.resource !== 'string' )
    throw new Error('Publish: Invalid format, resource must be a string');

  // update vargs properties given in args
  for (var prop in args) {
    vargs[prop] = args[prop];
  }

  return this.connection.publish(vargs);
}

/**
 * write - write (persistent message) <data> to topic defined by <channel> and <resource>
 * 
 * @param {String} channel - channel to write to
 * @param {String} resource - resource to write to
 * @param {Object} data - data to write
 * @param {Object} [args] - write options
 * 
 * @returns {Stream} this - for chaining
 * 
 * @api public
 * 
 * @example stream.write('channel', 'resource', 'Hello World');
 */
Stream.prototype.write = function(channel, resource, data, args) {
  var vargs = {};
  vargs.channel = channel;
  vargs.resource = resource;
  vargs.data = data;
  
  if(!args) args = {};

  if( typeof vargs.channel !== 'string' )
    throw new Error('Write: Invalid format, channel must be a string');

  if( typeof vargs.resource !== 'string' )
    throw new Error('Write: Invalid format, resource must be a string');

  // update vargs properties given in args
  for (var prop in args) {
    vargs[prop] = args[prop];
  }

  return this.connection.write(vargs);
}

/**
 * subscribe - subscribe to topic defined by <channel> and <resource>
 * 
 * @param {String} channel - channel to subscribe to
 * @param {String} resource - resource to subscribe to
 * @param {Object} [args] - subscribe options, includes:
 *   {Number} ttl - validity delay of the subscription - reserved for future use
 *   {Boolean} read - indicates if read access is set
 *   {Boolean} write - indicates if write access is set (for write and publish operations)
 *   {Function} callback - function to call when a message sent to the subscribed topic is received
 * @param {Function} callback - function to call when a message sent to the subscribed topic is received.
 *   Overrides callback element in <args> if any 
 * @returns {Stream} this - for chaining
 * 
 * @api public
 * 
 * @example 
 *   stream.subscribe('channel', 'resource', {read: true, write: true}, function(message) {console.log(message)});
 * @example stream.subscribe('channel', {read: true, write: true, function(message) {console.log(message)}});
 * @example stream.subscribe('channel', function(message) {console.log(message)});
 */
Stream.prototype.subscribe = function(channel, resource, args, callback) {
  var vargs = {};
  //3 arguments, last is callback
  if ('function' === typeof args) {
    callback = args;
    args = null;
  }
  
  //resource not given (wildcard) args as second argument
  if ('object' === typeof resource) {
    args = resource;
    resource = this.wildcard;
  }

  //resource not given (wildcard) callback as second argument
  if ('function' === typeof resource) {
    callback = resource;
    resource = this.wildcard;
  }
  
  if(!args) args = {};
  callback = callback || args.callback;
  
  vargs.channel = channel;
  vargs.resource = resource;
  vargs.ttl = args.ttl || 0;
  vargs.read = (typeof( args.read ) === 'undefined' ) ? true : args.read === true; //default true
  vargs.write = args.write === true; // default false

  if( typeof vargs.ttl !== 'number' ) 
    throw new Error('Subscribe: Invalid format, ttl must be a number');

  if( vargs.read && !callback ) 
    throw new Error('Subscribe: Callback not specified. The callback parameter is mandatory for read operations');

  return this.connection.subscribe(vargs, callback);
}

/**
 * unsubscribe - unsubscribe from topic defined by <channel> and <resource>
 * 
 * @param {String} channel - channel to unsubscribe from
 * @param {String} resource - resource to unsubscribe from
 * @returns {Stream} this - for chaining
 * @api public
 * 
 * @example stream.unsubscribe('channel', 'resource');
 * @example stream.unsubscribe('channel');
 */
Stream.prototype.unsubscribe = function(channel, resource) {
  resource = resource || this.wildcard;

  if( typeof channel !== 'string')
    throw new Error('Unsubscribe: Invalid format, channel must be a string');

  if( typeof resource !== 'string' )
    throw new Error('Unsubscribe: Invalid format, resource must be a string');

  var subscribe = this.removeSubscription( channel, resource ); 
  this.connection.unsubscribe( subscribe );
  if( subscribe ) {
    subscribe = null;
  }
  return this;
}

/**
 * unsubscribeAll - unsubscribe from all topics the stream is subscribed to
 *
 * @returns {Stream} this - for chaining
 * @api public
 *
 * @example stream.unsubscribeAll()
 */
Stream.prototype.unsubscribeAll = function () {

  var self = this
  this.subscriptions.forEach(function (subscription) {
    self.connection.unsubscribe(subscription)
  })

  return this
}

module.exports = Stream;
