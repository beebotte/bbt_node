"use strict";

var request = require('request')
  , crypto = require('crypto')
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
  if( self.bbt.transport.token ) {
    var query =  'token=' + self.bbt.transport.token + '&username=' + (self.bbt.userinfo.username || '');
  } else {
    var query =  'key=' + self.bbt.transport.key + '&username=' + (self.bbt.userinfo.username || '');
  }
  this.connection = require('socket.io-client')(self.getWsUrl(), {query: query });
  this.connection.on('connect', function () {
    self.connected = true;
    self.bbt.emit('connected');
  });
  this.connection.on('error', function (err) {
    self.bbt.emit('error', err);
  });

  this.connection.on('reconnect', function () {
    self.connected = true;
    self.bbt.emit('reconnected');
    
    self.onConnection();
  });

  this.connection.on('disconnect', function () {
    self.connected = false;
    self.bbt.emit('disconnected');
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
  
  return this.bbt;
}

Connection.prototype.disconnect = function () {
  if(this.connection) this.connection.disconnect();
  return this.bbt;
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
  return this.bbt;
}


Connection.prototype.do_subscribe = function(subscription) {
  var self = this;
  if(!self.connected) return self.bbt;
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
  
  /* Utility function for signing connection 
   * Will be used with function based authentication method 
   * (self sufficient authentication - requires Secret Key) 
   */
  function signSubscription ( ) {
    var to_sign = args.sid + ':' + args.channel + '.' + args.resource + ':ttl=' + args.ttl + ':read=' + args.read + ':write=' + args.write;

    if( self.bbt.userinfo.userid ) to_sign = to_sign + ':userid=' + self.bbt.userinfo.userid;

    var signature = crypto.createHmac('sha1', self.bbt.transport.secretKey).update(to_sign).digest('base64');
    var auth = { auth: self.bbt.transport.key + ':' + signature };
    
    if( self.bbt.userinfo.userid ) auth.userid = self.bbt.userinfo.userid;

    return auth;
  }

  if( authNeeded() ) {
    if( ! self.bbt.transport.auth_endpoint && self.bbt.transport.auth_method !== 'fct' ) {
      self.bbt.emit('subscribeError', new Error('Authentication error: Missing authentication endpoint!'), args);
      return self.bbt;
    }
    if(self.connected && self.connection && self.connection.io.engine.id && self.connection.io.engine.id) {
      args.sid = self.connection.io.engine.id;
      if(self.bbt.transport.auth_method === 'get') {

        var uri = self.bbt.transport.auth_endpoint + '?' + querystring.stringify(args);
        var options = {
            url: url.parse(uri),
            method: 'GET',
        }

        request(options, function (error, response, body) {
            if(error) {
              self.bbt.emit('subscribeError', error, args);
              return self.bbt;
            }
            if (!error && response.statusCode == 200) {
              if( typeof body === 'string' ) {
                try {
                  body = JSON.parse(body);
                } catch(e) {
                  self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
                  return self.bbt;
                }
              }
              args.sig = body.auth;
              if( body.userid ) args.userid = body.userid;
              if(self.send('control', 'subscribe', args)) {
                subscription.subscribe();
                self.bbt.emit('subscribed', subscription);
                return self.bbt;
              }else {
                  self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
                  return self.bbt;
              }
            }else {
                self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
                return self.bbt;
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
            if(error) {
              self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
              return self.bbt;
            }
            if (!error && response.statusCode == 200) {
              if( typeof body === 'string' ) {
                try {
                  body = JSON.parse(body);
                } catch(e) {
                  self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
                  return self.bbt;
                }
              }
              args.sig = body.auth;
              if( body.userid ) args.userid = body.userid;
              if(self.send('control', 'subscribe', args)) {
                subscription.subscribe();
                self.bbt.emit('subscribed', subscription);
                return self.bbt;
              }else {
                  self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
                  return self.bbt;
              }
            }else {
              self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
              return self.bbt;
            }
        });
      }else if (self.bbt.transport.auth_method === 'fct') {
        if( self.bbt.transport.token ) {
          args.token = self.bbt.transport.token;
          if( self.bbt.userinfo.userid ) args.userid = self.bbt.userinfo.userid;
        } else {
          var sig = signSubscription( );
          if( !sig ) {
            self.bbt.emit('subscribeError', new Error('Unable to authenticate client'), args);
            return self.bbt;
          }
          args.sig = sig.auth;
          if( sig.userid ) args.userid = sig.userid;
        }
        if(self.send('control', 'subscribe', args)) {
          subscription.subscribe();
          process.nextTick(function() {
            self.bbt.emit('subscribed', subscription);
          });
          return self.bbt;
        }else {
            self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
            return self.bbt;
        }
      }else {
        self.bbt.emit('subscribeError', new Error('Unsupported authentication method!'), args);
        return self.bbt;
      }
    } else {
      self.bbt.emit('subscribeError', new Error('Connection error encountered'), args);
      return self.bbt;
    }
  }else {
    if(self.send('control', 'subscribe', args)) {
      subscription.subscribe();
      self.bbt.emit('subscribed', subscription);
      return self.bbt;
    }else {
      self.bbt.emit('subscribeError', new Error('Unexpected error encountered while subscribing'), args);
      return self.bbt;
    }
  }
}

Connection.prototype.unsubscribe = function(subscription) {
  var self = this;
  if(subscription) {
    subscription.unsubscribe();
    if( this.send('control', 'unsubscribe', {channel: subscription.channel, resource: subscription.resource }) ) {
      self.bbt.emit('unsubscribed', {channel: subscription.channel, resource: subscription.resource });
    } else {
      self.bbt.emit('unsubscribeError', new Error('Unexpected error encountered while unsubscribing'), {channel: subscription.channel, resource: subscription.resource });
    }
  }
  return self.bbt;
}

Connection.prototype.publish = function(args) {
  var self = this;
  var subscription = this.bbt.getSubscriptionWithPermission(args.channel, args.resource, false, true);

  if(subscription && subscription.hasWritePermission()) {
    if(this.send('stream', 'emit', {channel: args.channel, resource: args.resource, data: args.data})) {
      self.bbt.emit('published', args);
    }else {
      self.bbt.emit('publishError', new Error('Error while publishing message'), args);
    }
  } else {
    self.bbt.emit('publishError', 'Permission error: cant\'t publish on the given resource!', args);
  }
  return self.bbt;
}

Connection.prototype.write = function(args) {
  var self = this;
  var subscription = self.bbt.getSubscriptionWithPermission(args.channel, args.resource, false, true);

  if(subscription && subscription.hasWritePermission()) {
    if(this.send('stream', 'write', {channel: args.channel, resource: args.resource, data: args.data})) {
      self.bbt.emit('written', args);
    }else {
      self.bbt.emit('writeError', new Error('Error while sending write message'), args);
    }
  }else {
    self.bbt.emit('writeError', new Error('Permission error: cant\'t write on the given resource!'), args);
  }
  return self.bbt;
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
