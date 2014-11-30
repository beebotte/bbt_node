"use strict";

var request = require('request')
  , querystring = require('querystring')
  , url = require('url');

var PROTO = 1; //Version of Beebotte Protocol

/** @constructor */
function Connection (bbt) {
  this.bbt = bbt;
  this.connected = false;
  this.connection = null;
}

Connection.prototype.onConnection = function() {
  for(var c in this.bbt.subscriptions) {
    this.do_subscribe(this.bbt.subscriptions[c]);
  }
}

Connection.prototype.getWsUrl = function() {
  var p = (this.bbt.transport.ssl === true)? this.bbt.transport.sport : this.bbt.transport.port;
  return ((this.bbt.transport.ssl === true)? 'https://' : 'http://' ) + this.bbt.transport.ws_host + ':' + p;
}

Connection.prototype.connect = function () {
  //Do we really need this???
  if(this.connection) {
    this.connection.io.reconnect();
    return;
  }

  var self = this;
  var query =  'key=' + this.bbt.transport.key + '&username=' + (self.bbt.userinfo.username || '');
  this.connection = require('socket.io-client')(self.getWsUrl(), {query: query });
  this.connection.on('connect', function () {
    self.connected = true;
    
    self.connected = true;
    self.bbt.emit('connected', self.bbt);
    
    self.onConnection();
  });

  this.connection.on('disconnect', function () {
    self.connected = false;
    self.bbt.emit('disconnected', self.bbt);
  });

  this.connection.on('message', function (msg) {
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
  });
  
}

Connection.prototype.disconnect = function () {
  if(this.connection) this.connection.io.disconnect();
}

//for internal use only
Connection.prototype.send_auth = function(sig, source) {
  var self = this;
  if(self.send('control', 'authenticate', {auth: sig.auth, source: source})) {
    this.authenticated = true;
    return true;
  }else {
    this.authenticated = false
    return false;
  }
}

Connection.prototype.subscribe = function(args, callback) {
  var subscription = this.bbt.getSubscription(args.channel, args.resource);

  if(subscription) {
    subscription.update(args, callback);
  }else {
    subscription = this.bbt.addSubscription(args, callback);
    this.do_subscribe(subscription);
  }
}


Connection.prototype.do_subscribe = function(subscription) {
  var self = this;
  if(!self.connected) return;
  var args = {};
  args.channel = subscription.channel;
  args.resource = subscription.resource || self.bbt.wildcard;
  args.ttl = args.ttl || 0;
  args.read = subscription.read; 
  args.write = subscription.write;
  if(typeof self.bbt.userinfo !== 'undefined') {
    args.userinfo = self.bbt.userinfo;
  }

  //Authentication required for write access and for read access to private or presence resources
  function authNeeded() {
    if(args.write === true) return true;
    if(args.channel.indexOf('private-') === 0) return true;
    if(args.channel.indexOf('presence-') === 0) return true;
    return false;
  }
  
  if( authNeeded() ) {
    if( ! self.bbt.transport.auth_endpoint ) return self.bbt.emit('subscribeError', new Error('Authentication error: Missing authentication endpoint!'), args);
    if(self.connected && self.connection && self.connection.io.engine.id && self.connection.io.engine.id) {
      args.sid = self.connection.io.engine.id;
      if(self.bbt.transport.auth_method === 'get') {

        var uri = self.bbt.transport.auth_endpoint + '?' + querystring.stringify(args);
        var options = {
            url: url.parse(uri),
            method: 'GET',
        }

        request(options, function (error, response, body) {
            if(error) return self.bbt.emit('subscribeError', error, args);
            if (!error && response.statusCode == 200) {
              if( typeof body === 'string' ) {
                try {
                  body = JSON.parse(body);
                } catch(e) {
                  return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
                }
              }
              args.sig = body.auth;
              if( body.userid ) args.userid = body.userid;
              if(self.send('control', 'subscribe', args)) {
                subscription.subscribe();
                return self.bbt.emit('subscribed', subscription);
              }else {
                  return self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
              }
            }else {
                return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
            }
        });
      }else if (self.bbt.transport.auth_method === 'post') {
        uri = self.bbt.transport.auth_endpoint;
        options = {
          url: url.parse(uri),
          method: 'POST',
          body: JSON.stringify(args)
        }

        options.headers = {
          'Content-Type': 'application/json'
        };

        request(options, function (error, response, body) {
            if(error) return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
            if (!error && response.statusCode == 200) {
              if( typeof body === 'string' ) {
                try {
                  body = JSON.parse(body);
                } catch(e) {
                  return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
                }
              }
              args.sig = body.auth;
              if( body.userid ) args.userid = body.userid;
              if(self.send('control', 'subscribe', args)) {
                subscription.subscribe();
                return self.bbt.emit('subscribed', subscription);
              }else {
                  return self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
              }
            }else {
              return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
            }
        });
      }else if (self.bbt.transport.auth_method === 'fct') {
        sig = self.bbt.transport.auth_endpoint(args.sid, args.channel, args.resource, args.ttl, args.read, args.write);
        if( !sig ) return self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
        args.sig = sig.auth;
        if( sig.userid ) args.userid = sig.userid;
        if(self.send('control', 'subscribe', args)) {
          subscription.subscribe();
          return self.bbt.emit('subscribed', subscription);
        }else {
            return self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
        }
      }else {
        return self.bbt.emit('subscribeError', new Error('Unsupported authentication method!'), args);
      }
    } else {
      return self.bbt.emit('subscribeError', new Error('Connection error encountered'), args);
    }
  }else {
    if(self.send('control', 'subscribe', args)) {
      subscription.subscribe();
      return self.bbt.emit('subscribed', subscription);
    }else {
      return self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
    }
  }
}

Connection.prototype.unsubscribe = function(args) {
  var self = this;
  var subscription = this.bbt.getSubscription(args.channel, args.resource);
  if(subscription) {
    subscription.unsubscribe();
    if( this.send('control', 'unsubscribe', {channel: args.channel, resource: args.resource }) ) {
      return self.bbt.emit('unsubscribed', {channel: args.channel, resource: args.resource });
    } else {
      return self.bbt.emit('unsubscribeError', new Error('Unexpected error encountered while unsubscribing'), {channel: args.channel, resource: args.resource });
    }
  }
  return;
}

Connection.prototype.publish = function(args) {
  var self = this;
  var subscription = this.bbt.getSubscriptionWithPermission(args.channel, args.resource, false, true);

  if(subscription && subscription.hasWritePermission()) {
    if(this.send('stream', 'emit', {channel: args.channel, resource: args.resource, data: args.data})) {
      return self.bbt.emit('published', args);
    }else {
      return self.bbt.emit('publishError', new Error('Error while publishing message'), args);
    }
  }
  return self.bbt.emit('publishError', 'Permission error: cant\'t publish on the given resource!', args);
}

Connection.prototype.write = function(args) {
  var self = this;
  var subscription = self.bbt.getSubscriptionWithPermission(args.channel, args.resource, false, true);

  if(subscription && subscription.hasWritePermission()) {
    if(this.send('stream', 'write', {channel: args.channel, resource: args.resource, data: args.data})) {
      return self.bbt.emit('written', args);
    }else {
      return self.bbt.emit('writeError', new Error('Error while sending write message'), args);
    }
  }
  return self.bbt.emit('writeError', new Error('Permission error: cant\'t write on the given resource!'), args);
}

//For internal use only    
Connection.prototype.send = function(cname, evt, data) {
  if(this.connection) {
    this.connection.json.send({version: PROTO, channel: cname, event: evt, data: data});
    return true;
  }else {
    return false;
  }
}

module.exports = Connection