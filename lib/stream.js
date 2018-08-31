'use strict'

var events = require('events')
var util = require('util')
var Subscription = require('./subscription')

function nop () {}

/** @constructor
 * Stream Constructor
 *
 * @param {Object} [options] - Stream connection options
 */
function Stream (options) {

  //check options
  if (!options) {

    throw new Error('Initialization error: missing transport options')
  }

  this._initDefaults() //Initialize default params
  this._updateParams(options)
  this._initTransport(options.transport)

  var self = this

  self.on('error', nop)

  this.subscriptions = []

  this.getSubscriptions = function () {

    return this.subscriptions
  }

  this.addSubscription = function (args, callback) {

    var c = new Subscription(args, callback, this)
    this.subscriptions[c.eid] = c
    return c
  }

  this.getSubscription = function (channel, resource) {

    if (this.subscriptions[channel + this.seperator + resource]) {
      return this.subscriptions[channel + this.seperator + resource]
    }
    return null
  }

  this.getAnySubscription = function (channel, resource) {

    if (this.subscriptions[channel + this.seperator + resource]) {
      return this.subscriptions[channel + this.seperator + resource]
    } else if (this.subscriptions[channel + this.seperator + this.wildcard]) {
      return this.subscriptions[channel + this.seperator + this.wildcard]
    } else {
      return null
    }
  }

  this.removeSubscription = function (channel, resource) {

    resource = resource || this.wildcard
    if (this.subscriptions[channel + this.seperator + resource]) {
      var retval = this.subscriptions[channel + this.seperator + resource]
      delete this.subscriptions[channel + this.seperator + resource]
      return retval
    }

    return null
  }

  this.getSubscriptionWithPermission = function (channel, resource, read, write) {

    var Subscription = this.subscriptions[channel + this.seperator + resource]
    var match = false

    if (Subscription) {

      match = true

      if (read) {
        match = Subscription.hasReadPermission()
      }

      if (write) {
        match = Subscription.hasWritePermission()
      }

      if (match) {
        return Subscription
      }
    } else {

      Subscription = this.subscriptions[channel + this.seperator + this.wildcard]

      if (Subscription) {

        match = true

        if (read) {
          match = Subscription.hasReadPermission()
        }

        if (write) {
          match = Subscription.hasWritePermission()
        }

        if (match) {
          return Subscription
        }
      }
    }

    return null
  }

  this.connection = new this.ConnectionFactory(this)
  this.connect()
}

util.inherits(Stream, events.EventEmitter)

/*** Constant Values ***/
Stream.PROTO      = 1 //Version of Beebotte Protocol
Stream.ws_host    = 'ws.beebotte.com'
Stream.mqtt_host  = 'mqtt.beebotte.com'
Stream.host       = 'beebotte.com'
Stream.port       = 80  //Port for clear text connections
Stream.sport      = 443 //Port for secure (TLS) connections

/**
 * _initDefaults - initialize with default parameters
 *
 * @private
 **/
Stream.prototype._initDefaults = function () {

  this.cipher = null
  this.userinfo = {}
  this.seperator = '.'
  this.wildcard = '*'
}

/**
 * _initTransport - initialize transport for this stream connection
 * @param {Object} [transport] - transport parameters
 *
 * @private
 **/
Stream.prototype._initTransport = function (transport) {

  this.transport = {}

  if (transport.type === 'socketio') {
    return this._initSocketioTransport(transport)
  } else if (transport.type === 'mqtt') {
    return this._initMqttTransport(transport)
  } else {
    throw new Error('Initialization error: unrecognized transport protocol')
  }
}

/**
 * _initSocketioTransport - initialize Socket.io transport for this stream connection
 * @param {Object} [transport] - Socket.io transport parameters
 *
 * @private
 **/
Stream.prototype._initSocketioTransport = function (transport) {

  this.transport = {}
  this.transport.key = transport.key || transport.apiKey

  if (!this.transport.key && !transport.token) {
    throw new Error('Initialization error: missing API AccessKey or Channel Token')
  }

  this.seperator = '.'
  this.wildcard = '*'

  this.ConnectionFactory = require('./socketio')

  this.transport.ws_host  = Stream.ws_host
  this.transport.host     = Stream.host
  this.transport.port     = Stream.port
  this.transport.sport    = Stream.sport

  this.transport.ssl = true
  this.transport.auth_endpoint = null
  this.transport.auth_method = 'get'

  // If the Secret Key is provided, no need for external authentication endpoint!
  if (transport.secretKey) {
    this.transport.secretKey = transport.secretKey
    // if secretKey is provided defaults to function based auth.
    this.transport.auth_method = 'fct'
  } else if (transport.token) {
    this.transport.token = transport.token
    // if Channel Token is provided defaults to function based auth.
    this.transport.auth_method = 'fct'
  } else {
    if (transport.auth_endpoint) {
      this.transport.auth_endpoint = transport.auth_endpoint
    }
    if (transport.auth_method) {
      this.transport.auth_method = transport.auth_method
    }
  }

  if (transport.host) {
    this.transport.host = transport.host
  }

  if (transport.ws_host) {
    this.transport.ws_host = transport.ws_host
  }

  if (transport.port) {
    this.transport.port = transport.port
  }

  if (transport.sport) {
    this.transport.sport = transport.sport
  }

  if (transport.ssl === false) {
    this.transport.ssl = transport.ssl //set to false
  }
}

/**
 * _initMqttTransport - initialize MQTT transport for this stream connection
 * @param {Object} [transport] - MQTT transport parameters
 *
 * @private
 **/
Stream.prototype._initMqttTransport = function (transport) {

  this.transport = {}

  this.seperator = '/'
  this.wildcard = '#'
  this.transport = transport

  this.ConnectionFactory = require('./mqtt')

  if (transport.apiKey && transport.secretKey && transport.username) {
    transport.authMethod = 'signature'
  } else if (transport.secretKey) {
    transport.authMethod = 'secretKey'
  } else if (transport.token) {
    transport.authMethod = 'token'
  }

  this.transport.mqtt_host = transport.mqtt_host || Stream.mqtt_host
  //default to encrypted transport
  this.transport.ssl = transport.ssl === false ? false : true

  if (!transport.port) {
    this.transport.port = this.transport.ssl === false ? 1883 : 8883
  }
}

/**
 * _updateParams - update connection parameters
 *
 * @private
 **/
Stream.prototype._updateParams = function (params) {

  if (params.userinfo) {
    this.userinfo = params.userinfo
  }

  if (params.username) {
    this.userinfo.username = params.username
  }

  if (params.cipher) {
    this.cipher = params.cipher
  }
}

/**
 * setUsername - associate a friendly username with this stream connection.
 * This method MAY only be called before any subscription is made otherwise
 * it will be ignored.
 *
 * @returns {Stream} this - for chaining
 *
 * @public
 **/
Stream.prototype.setUsername = function (username) {

  this.userinfo.username = username
  return this
}

/**
 * setUserid - associate a userid with this stream connection.
 * This method MAY only be called before any subscription is made.
 *
 * @returns {Stream} this - for chaining
 *
 * @public
 **/
Stream.prototype.setUserid = function (userid) {

  this.userinfo.userid = userid
  return this
}

/**
 * connect - connect this stream. This method will be automatically called on stream creation.
 *
 * @returns {Stream} this - for chaining
 *
 * @public
 *
 * @example stream.connect()
 */
Stream.prototype.connect = function () {
  return this.connection.connect()
}

/**
 * disconnect - disconnect this stream.
 *
 * @public
 *
 * @example stream.disconnect()
 */
Stream.prototype.disconnect = function () {
  return this.connection.disconnect()
}

/**
 * publish - publish <data> to topic defined by <channel> and <resource>
 *
 * @param {String} channel - channel to publish to
 * @param {String} resource - resource to publish to
 * @param {Object} data - data to publish
 * @param {Object} [args] - publish options, includes:
 *   {Boolean} route - indicates if routing (bridging) is set. Defaults to true
 *   {Number} ts - indicates the timestamp of the message in milliseconds since epoch. Defaults to current time.
 *   {Number} qos - indicates MQTT QoS level. Reserved for MQTT transport. Defaults to 0.
 *   {Boolean} retain - indicates if message should be retained. Reserved for MQTT trasport. Defaults to false.
 *   {Boolean} ispublic - indicates if the message is public or private. Reserved for MQTT transport. Defaults to false.
 *
 * @returns {Stream} this - for chaining
 *
 * @public
 *
 * @example stream.publish('channel', 'resource', 'Hello World')
 * @example
 *   stream.publish('channel', 'resource', 'Hello World', {route: false})
 */
Stream.prototype.publish = function (channel, resource, data, args) {

  args = args || {}

  if (typeof channel !== 'string') {
    throw new Error('Publish: Invalid format, channel must be a string')
  }

  if (typeof resource !== 'string') {
    throw new Error('Publish: Invalid format, resource must be a string')
  }

  var message = {
    channel: channel,
    resource: resource,
    data: data
  }

  if (typeof args.ts === 'number') {
    message.ts = args.ts
  }

  if (args.route === false) {
    message.route = args.route
  }

  return this.connection.publish(message, args)
}

/**
 * write - write (persistent message) <data> to topic defined by <channel> and <resource>
 *
 * @param {String} channel - channel to write to
 * @param {String} resource - resource to write to
 * @param {Object} data - data to write
 * @param {Object} [args] - write options, includes:
 *   {Boolean} route - indicates if routing (bridging) is set. Defaults to true
 *   {Number} ts - indicates the timestamp of the message in milliseconds since epoch. Defaults to current time.
 *   {Number} qos - indicates MQTT QoS level. Reserved for MQTT transport. Defaults to 0.
 *   {Boolean} retain - indicates if message should be retained. Reserved for MQTT trasport. Defaults to false.
 *   {Boolean} ispublic - indicates if the message is public or private. Reserved for MQTT transport. Defaults to false.
 *
 * @returns {Stream} this - for chaining
 *
 * @public
 *
 * @example stream.write('channel', 'resource', 'Hello World')
 * @example
 *   stream.write('channel', 'resource', 'Hello World', {route: false})
 */
Stream.prototype.write = function (channel, resource, data, args) {

  args = args || {}

  if (typeof channel !== 'string') {
    throw new Error('Write: Invalid format, channel must be a string')
  }

  if (typeof resource !== 'string') {
    throw new Error('Write: Invalid format, resource must be a string')
  }

  var message = {
    channel: channel,
    resource: resource,
    data: data,
  }

  if (typeof args.ts === 'number') {
    message.ts = args.ts
  }

  if (args.route === false) {
    message.route = args.route
  }

  return this.connection.write(message, args)
}

/**
 * subscribe - subscribe to topic defined by <channel> and <resource>
 *
 * @param {String} channel - channel to subscribe to
 * @param {String} resource - resource to subscribe to
 * @param {Object} args - subscribe options, includes:
 *   {Number} args.ttl - validity delay of the subscription - reserved for future use
 *   {Boolean} args.read - indicates if read access is set
 *   {Boolean} args.write - indicates if write access is set (for write and publish operations)
 *   {Function} args.callback - function to call when a message sent to the subscribed topic is received
 * @param {Function} callback - function to call when a message sent to the subscribed topic is received.
 *   Overrides callback element in <args> if any
 * @returns {Stream} this - for call chaining
 *
 * @public
 *
 * @example
 *   stream.subscribe('channel', 'resource', {read: true, write: true}, function(message) {console.log(message)})
 * @example stream.subscribe('channel', {read: true, write: true, function(message) {console.log(message)}})
 * @example stream.subscribe('channel', function(message) {console.log(message)})
 */
Stream.prototype.subscribe = function (channel, resource, args, callback) {

  var vargs = {}
  //3 arguments, last is callback
  if ('function' === typeof args) {
    callback = args
    args = {}
  }

  //resource not given (wildcard) args as second argument
  if ('object' === typeof resource) {
    args = resource
    resource = this.wildcard
  }

  //resource not given (wildcard) callback as second argument
  if ('function' === typeof resource) {
    callback = resource
    resource = this.wildcard
    args = {}
  }

  args = args || {}
  callback = callback || args.callback

  vargs.channel = channel
  vargs.resource = resource
  vargs.ttl = args.ttl || 0
  vargs.read = (typeof args.read ) === 'undefined' ? true : args.read === true //default true
  vargs.write = args.write === true // default false

  if (typeof vargs.ttl !== 'number') {
    throw new Error('Subscribe: Invalid format, ttl must be a number')
  }

  if (vargs.read && !callback) {
    throw new Error('Subscribe: Callback not specified. The callback parameter is mandatory for read operations')
  }

  return this.connection.subscribe(vargs, callback)
}

/**
 * unsubscribe - unsubscribe from topic defined by <channel> and <resource>
 *
 * @param {String} channel - channel to unsubscribe from
 * @param {String} resource - resource to unsubscribe from
 * @returns {Stream} this - for chaining
 * @public
 *
 * @example stream.unsubscribe('channel', 'resource')
 * @example stream.unsubscribe('channel')
 */
Stream.prototype.unsubscribe = function (channel, resource) {

  resource = resource || this.wildcard

  if (typeof channel !== 'string') {
    throw new Error('Unsubscribe: Invalid format, channel must be a string')
  }

  if (typeof resource !== 'string') {
    throw new Error('Unsubscribe: Invalid format, resource must be a string')
  }

  var subscribe = this.getAnySubscription( channel, resource )
  this.connection.unsubscribe( subscribe )

  return this
}

/**
 * unsubscribeAll - unsubscribe from all topics the stream is subscribed to
 *
 * @returns {Stream} this - for chaining
 * @public
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

module.exports = Stream
