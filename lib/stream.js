"use strict";

var events = require('events')
  , util = require('util')
  , Subscription = require('./subscription');
  
function nop( err ) {console.log(err);}

/** @constructor 
 * Class: BBT
 * An object container for all Beebotte library functions.
 * 
 * @param key_id Access key associated with your Beebotte account
 * @param options optional parameters for initializing beebotte
 *   {
 *     auth_endpoint: authentication endpoint 
 *     auth_method: HTTP method (GET or POST) to be used for authentication purposes. Defaults to GET.
 *     server: URL to beebotte. default beebotte.com
 *     ssl: boolean - indicates whether ssl should be used. default false.
 *     username: string - assigns a friendly username
 *     cipher: cryptographic key for message data encryption. Defaults to no encryption.
 *   }
 */
function Stream(options) {
  if ( !options ) throw new Error('Initialization error: missing transport options');

  this.initDefaults(); //Initialize default params
  this.updateParams(options);

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

  this.initTransport(options.transport);
  
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

Stream.prototype.initDefaults = function() {
  this.cipher = null;
  this.userinfo = {};
  this.seperator = '.';
  this.wildcard = '*';
}

Stream.prototype.initTransport = function(transport) {
  this.transport = {};
  
  if( transport.type === 'socketio' ) return this._initSocketioTransport(transport);
  else if( transport.type === 'mqtt' ) return this._initMqttTransport(transport);
  else throw new Error('Initialization error: unrecognized transport protocol');
}

Stream.prototype._initSocketioTransport = function(transport) {
  this.transport = {};
  
  if( !transport.key ) throw new Error('Initialization error: missing API AccessKey');
  
  this.seperator = '.';
  this.wildcard = '*';
  this.transport.key = transport.key;

  this.ConnectionFactory = require('./socketio');

  this.transport.ws_host  = Stream.ws_host;
  this.transport.host     = Stream.host;
  this.transport.port     = Stream.port;
  this.transport.sport    = Stream.sport;

  this.transport.ssl = true;
  this.transport.auth_endpoint = null;
  this.transport.auth_method = 'get';

  if(transport.auth_endpoint) this.transport.auth_endpoint = transport.auth_endpoint;
  if(transport.auth_method) this.transport.auth_method = transport.auth_method;
  if(transport.host) this.transport.host = transport.host;
  if(transport.ws_host) this.transport.ws_host = transport.ws_host;
  if(transport.port) this.transport.port = transport.port;
  if(transport.sport) this.transport.sport = transport.sport;
  if(transport.ssl === false) this.transport.ssl = transport.ssl; //set to false
}

Stream.prototype._initMqttTransport = function(transport) {
  this.transport = {};
  
  this.seperator = '/';
  this.wildcard = '#';
  this.transport = transport;

  this.ConnectionFactory = require('./mqtt');

  this.transport.mqtt_host = transport.mqtt_host || Stream.mqtt_host;
  //default to encrypted transport
  this.transport.ssl       = (transport.ssl === false)? false : true;
  if( !transport.port ) this.transport.port = (this.transport.ssl === false)? 1883 : 8883;
}

Stream.prototype.updateParams = function(params) {
  if(params.userinfo) this.userinfo = params.userinfo;
  if(params.username) this.userinfo.username = params.username;

  if(params.cipher) this.cipher = params.cipher;
}

/**
 * Sets the friendly username associated with this connection.
 * This method should be called before any subscription is made.
 **/
Stream.prototype.setUsername = function(username) {
  this.userinfo.username = username;
}

/**
 * Connects this instance to the Beebotte platform if it is not connected. This method will be automatically called when creating a new instance of Stream.
 */
Stream.prototype.connect = function() {
  this.connection.connect();
}

/**
 * Disconnets this beebotte instance. This will disconnect the websocket connection with beebotte servers.
 */
Stream.prototype.disconnect = function() {
  return this.connection.disconnect();
}

/**
 * Sends a transient message to Beebotte. This method require prior 'write' permission on the specified resource (see Stream.grant method).
 * 
 * @param {Object} args: {
 *   {string, required} channel name of the channel. It can be prefixed with 'private-' to indicate a private resource.
 *   {string, required} resource name of the resource.
 *   {Object, optional} data data message to publish to Bebotte.
 * }
 * @param {Object optional} data data message to publish to Beebotte. If args.data is present, it will override this parameter.
 */
Stream.prototype.publish = function(args, data) {
  var vargs = {};
  vargs.channel = args.channel;
  vargs.resource = args.resource;
  vargs.data = args.data || data;
  vargs.callback = args.callback || function() {};

  if( !vargs.channel )
    this.emit('publishError', new Error('Publish: Channel not specified'), args);

  if( !vargs.resource )
    this.emit('publishError', new Error('Publish: Resource not specified'), args);

  if( !vargs.data )
    this.emit('publishError', new Error('Publish: Data message not specified'));

  if( typeof vargs.channel !== 'string')
    this.emit('publishError', new Error('Publish: Invalid format, channel must be a string'), args);

  if( typeof vargs.resource !== 'string' )
    this.emit('publishError', new Error('Publish: Invalid format, resource must be a string'), args);

  return this.connection.publish(vargs);
}

/**
 * Sends a presistent message to Beebotte. This method require prior 'write' permission on the specified resource (see Stream.grant method).
 * A resource with the specified parameters must exist for this method to succeed. In addition, the message will inherit the access level of the channel. 
 * As the access level is specified by the existing channel parameters, it is not necessary to add the 'private-' prefix. 
 *
 * @param {Object} args: {
 *   {string, required} channel name of the channel. It can be prefixed with 'private-' to indicate a private resource.
 *   {string, required} resource name of the resource.
 *   {Object, optional} data data message to write to Bebotte.
 * }
 * @param {Object optional} data data message to write to Beebotte. If args.data is present, it will override this parameter.  
 */
Stream.prototype.write = function(args, data) {
  var vargs = {};
  vargs.channel = args.channel;
  vargs.resource = args.resource;
  vargs.data = args.data || data;
  vargs.callback = args.callback || function() {};

  if( !vargs.channel )
    return this.emit('writeError', new Error('Write: Channel not specified'), args);

  if( !vargs.resource )
    return this.emit('writeError', new Error('Write: Resource not specified'), args);

  if( !vargs.data )
    return this.emit('writeError', new Error('Write: Data message not specified'));

  if( typeof vargs.channel !== 'string' )
    return this.emit('writeError', new Error('Write: Invalid format, channel must be a string'), args);

  if( typeof vargs.resource !== 'string' )
    return this.emit('writeError', new Error('Write: Invalid format, resource must be a string'), args);

  return this.connection.write(vargs);
}

/**
 * Adds a callback listener to the specified resource that will called whenever a message associated with the same resource is published. If the 'channel' parameter is prefixed by 'private-' or 'presence-', this method will automatically trigger the authentication mechanism.
 *
 * @param {Object} args: {
 *   {string, required} channel name of the channel. It can be prefixed with 'private-' to indicate a private resource, or it can be prefixed with 'presence-' to indicate presence events.
 *   {string, optional} resource name of the resource.
 *   {number, optional} ttl time in milliseconds during which the subscription will be active.
 *   {boolean, optional} read will be ignored. Considered always as true.
 *   {boolean, optional} write write permission requested along the subscription. This gives the possibility to publish or write messages to the specified resource. Defaults to false.
 * }
 * @param callback function to be called when a message is received.
 * @return true on success false on failure
 */  
Stream.prototype.subscribe = function(args, callback) {
  var vargs = {};
  var cbk = callback || args.callback;
  vargs.channel = args.channel;
  vargs.resource = args.resource || this.wildcard;
  vargs.ttl = args.ttl || 0;
  vargs.read = args.read || true; //default true
  vargs.write = args.write === true; // default false

  if( !vargs.channel ) 
    return this.emit('subscribeError', new Error('Subscribe: Channel not specified'), args);

  if( typeof vargs.channel !== 'string') 
    return this.emit('subscribeError', new Error('Subscribe: Invalid format, channel must be a string'), args);

  if( typeof vargs.resource !== 'string' ) 
    return this.emit('subscribeError', new Error('Subscribe: Invalid format, resource must be a string'), args);

  if( typeof vargs.ttl !== 'number' ) 
    return this.emit('subscribeError', new Error('Subscribe: Invalid format, ttl must be a number'), args);

  if( typeof vargs.read !== 'boolean' ) 
    return this.emit('subscribeError', new Error('Subscribe: Invalid format, read element must be boolean'), args);

  if( typeof vargs.write !== 'boolean' ) 
    return this.emit('subscribeError', new Error('Subscribe: Invalid format, write element must be boolean'), args);

  if( vargs.read && !cbk ) 
    return this.emit('subscribeError', new Error('Subscribe: Callback not specified. The callback parameter is mandatory for read operations'), args);

  this.connection.subscribe(vargs, cbk);
}

/**
 * Stops listening to messages from the specified resource. 
 * 
 * @param {Object} args: {
 *   {string} channel name of the channel. It can be prefixed with 'private-' to indicate a private resource, or it can be prefixed with 'presence-' to indicate presence events.
 *   {string} resource name of the resource.
 * }
 * @return true on success false on failure
 */
Stream.prototype.unsubscribe = function(args) {
  var vargs = {};
  vargs.channel = args.channel;
  vargs.resource = args.resource || this.wildcard;

  if( !vargs.channel )
    return this.emit('unsubscribeError', new Error('Unsubscribe: Channel not specified'), args);

  if( typeof vargs.channel !== 'string')
    return this.emit('unsubscribeError', new Error('Unsubscribe: Invalid format, channel must be a string'), args);

  if( typeof vargs.resource !== 'string' )
    return this.emit('unsubscribeError', new Error('Unsubscribe: Invalid format, resource must be a string'), args);

  return this.connection.unsubscribe(vargs);
}

module.exports = Stream;
