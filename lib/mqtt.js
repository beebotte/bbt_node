"use strict";

var mqtt = require('mqtt');
var utils = require('./utils');

/** @constructor */
function Connection (bbt) {
  this.bbt = bbt;
  this.connected = false;
  this.connection = null;
  
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

  var auth = authOptions();
  if( self.bbt.transport.ssl ) {
    self.connection =  mqtt.createSecureClient(
      self.bbt.transport.port, 
      self.bbt.transport.mqtt_host,
      auth
    );
  } else {
    self.connection =  mqtt.createClient(
      self.bbt.transport.port, 
      self.bbt.transport.mqtt_host,
      auth
    );
  }
  
  self.connection.on('connect', function () {
    self.connected = true;
    self.bbt.emit('connected');
    self.onConnection();
  });

  //TODO: specific to MQTT - wildcard and plus signs, binary message
  this.connection.on('message', function (topic, message) {
    function parseTopic(topic) {
      var t = topic.split('/');
      if( t.length === 2 ) {
        return { channel: t[0], resource: t[1] };
      }
      return null;
    }
    var t = parseTopic( topic );
    var msg;
    // TODO: replace with topic based channel and resource verification 
    try{
      msg = JSON.parse(message);
      if(msg.channel && msg.resource) {
        var subscription = self.bbt.getAnySubscription(msg.channel, msg.resource);
        if(subscription) {
          subscription.fct(msg);
        }else {
          //console.log('Warning! non subscribed message: ' + JSON.stringify(msg));
        }
      } else {
        //console.log('Warning! non conform message: ' + JSON.stringify(msg));
      }
    } catch (err) {
      /* TODO: we are expecting JSON formatted messages
       * shall we do anything with non JSON messages??? this is the question :)
       */
    }
  });
  return self.bbt;
}

Connection.prototype.disconnect = function () {
  var self = this;
  self.connection.end();
  self.connected = false;
  self.bbt.emit('disconnected');
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
  this.connection.subscribe(subscription.eid, {qos: 0});
  subscription.subscribe();
  return this.bbt.emit('subscribed', subscription);  
}

Connection.prototype.unsubscribe = function( subscription ) {
  if( subscription ) {
    subscription.unsubscribe();
    this.connection.unsubscribe(subscription.eid);
    this.bbt.emit( 'unsubscribed', {channel: subscription.channel, resource: subscription.resource });
  }
  return this.bbt;
}

Connection.prototype.publish = function(args) {
  var self = this;
  /**
   * In MQTT authentication is done on connection establishment
   * TODO: add channel authorization check before publishing
   */
  
  self.connection.publish( args.channel + this.bbt.seperator + args.resource, JSON.stringify( {channel: args.channel, resource: args.resource, data: args.data} ) );
  self.bbt.emit('published', args);
  return self.bbt;
}

Connection.prototype.write = function(args) {
  var self = this;
  /**
   * In MQTT authentication is done on connection establishment
   * TODO: add channel authorization check before publishing
   */
  
  self.connection.publish( args.channel + this.bbt.seperator + args.resource, JSON.stringify( {channel: args.channel, resource: args.resource, data: args.data, write: true} ) );
  self.bbt.emit('written', args);
  return self.bbt;
}

module.exports = Connection
