"use strict";

var mqtt = require('mqtt');
var utils = require('./utils');

/** @constructor */
function Connection (bbt) {
  this.bbt = bbt;
  this.connection = null;
  this.connected;
  
  var self = this;
  function verifyOpts() {
    var authMethod = self.bbt.transport.authMethod || 'secretKey';
    
    if( authMethod === 'secretKey' ) {
      if( !self.bbt.transport.secretKey ) {
        throw new Error ('Initialization error: you must provide your secret Key!');
      }
    } else if( authMethod === 'token' ) {
      if( !self.bbt.transport.token ) {
        throw new Error ('Initialization error: you must provide an authentication token!');
      }
    } else if( authMethod === 'signature' ) {
      if( !self.bbt.transport.apiKey || !self.bbt.transport.secretKey || !self.bbt.transport.username ) {
        throw new Error ('Initialization error: you must provide your api and secret Keys as well as your username!');
      }
    } else {
      throw new Error ('Initialization error: unrecognized authentication method!');
    }
  }
  
  verifyOpts();
}

Connection.prototype.onConnection = function() {
  for(var c in this.bbt.subscriptions) {
    this.do_subscribe(this.bbt.subscriptions[c]);
  }
}

Connection.prototype.connect = function () {
  var self = this;

  function authOptions() {
    var authMethod = self.bbt.transport.authMethod || 'secretKey';
    var auth;
    if( authMethod === 'secretKey' ) {
      auth = {username: self.bbt.transport.secretKey, password: ''}
    } else if( authMethod === 'token' ) {
      auth = {username: 'token:' + self.bbt.transport.token, password: ''}
    } else if( authMethod === 'signature' ) {
      var signature = utils.hmac(self.bbt.transport.secretKey, 'sha1', self.bbt.transport.username);
      auth = {username: self.bbt.transport.apiKey, password: self.bbt.transport.username + ':' + signature};
    }
    if( self.bbt.transport.clientId ) auth.clientId = self.bbt.transport.clientId;  
    auth.clean = ( self.bbt.transport.clean === false )? false : true;
    return auth;
  }

  function constructUrl() {
    if( self.bbt.transport.ssl ) {
      return 'mqtts://' + self.bbt.transport.mqtt_host + ':' + self.bbt.transport.port
    } else {
      return 'mqtt://' + self.bbt.transport.mqtt_host + ':' + self.bbt.transport.port
    }
  }

  var auth = authOptions();
  var url = constructUrl();

  self.connection = mqtt.connect(url, auth)
  
  self.connection.on('connect', function () {
    if(self.connected === false) {
      self.connected = true;
      self.onConnection();
      self.bbt.emit('reconnected');    
    }else {
      self.connected = true;
      self.bbt.emit('connected');
    }
  });

  self.connection.on('close', function () {
    // Avoid repetitive disconnected events
    if(self.connected) {
      self.connected = false;
      self.bbt.emit('disconnected');
    }
  });

  //TODO: specific to MQTT - wildcard and plus signs, binary message
  this.connection.on('message', function (topic, message) {
    function parseTopic(topic) {
      var t = topic.split('/');
      if ( t.length === 2 ) {
        return { channel: t[0], resource: t[1] };
      }
      return null;
    }
    var t = parseTopic( topic );
    if (t.channel && t.resource) {
    } else {
      //console.log('Warning! non conform message: ' + JSON.stringify(msg));
    }

    var subscription = self.bbt.getAnySubscription(t.channel, t.resource);

    if (subscription) {
      var msg;
      //normalize msg to Beebotte format
      try {
        msg = JSON.parse(message);
        if (typeof msg.data === 'undefined') {
          msg = {data: msg};
        }
      } catch (err) {
        // Non JSON formatted message, normalize anyway
        msg = {data: message.toString()};
      }
      msg.channel = msg.channel || t.channel;
      msg.resource = msg.resource || t.resource;
      subscription.fct(msg);
    } else {
      //console.log('Warning! non subscribed message: ' + JSON.stringify(msg));
    }
  });
  return self.bbt;
}

Connection.prototype.disconnect = function () {
  var self = this;
  self.connection.end();
  process.nextTick(function() {
    self.bbt.emit('disconnected');
  });
  return self.bbt;
}

Connection.prototype.subscribe = function(args, callback) {
  var subscription = this.bbt.getSubscription(args.channel, args.resource);

  if(subscription) {
    subscription.update(args, callback);
  } else {
    subscription = this.bbt.addSubscription(args, callback);
    this.do_subscribe(subscription);
  }
  return this.bbt;
}

Connection.prototype.do_subscribe = function(subscription) {
  var self = this;
  this.connection.subscribe(subscription.eid, {qos: 0});
  subscription.subscribe();
  process.nextTick(function() {
    self.bbt.emit('subscribed', subscription);  
  });
}

Connection.prototype.unsubscribe = function( subscription ) {
  var self = this;
  if( subscription ) {
    subscription.unsubscribe();
    this.connection.unsubscribe(subscription.eid);
    process.nextTick(function() {
      self.bbt.emit( 'unsubscribed', {channel: subscription.channel, resource: subscription.resource });
    });
  }
  return self.bbt;
}

Connection.prototype.publish = function(args) {
  var self = this;
  /**
   * In MQTT authentication is done on connection establishment
   * TODO: add channel authorization check before publishing
   */
  
  self.connection.publish( args.channel + this.bbt.seperator + args.resource, JSON.stringify( args ) );
  process.nextTick(function() {
    self.bbt.emit('published', args);
  });
  return self.bbt;
}

Connection.prototype.write = function(args) {
  var self = this;
  /**
   * In MQTT authentication is done on connection establishment
   * TODO: add channel authorization check before publishing
   */
  
  // set the write option
  args.write = true;

  self.connection.publish( args.channel + this.bbt.seperator + args.resource, JSON.stringify( args ) );
  process.nextTick(function() {
    self.bbt.emit('written', args);
  });
  return self.bbt;
}

module.exports = Connection
