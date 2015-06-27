// Copyright 2013 Beebotte. All rights reserved.

"use strict";

/**
 * Reference implementation of Beebotte's REST requests signing and authentication.
 */
var crypto = require('crypto')
    , request = require('request')
    , querystring = require('querystring')
    , url = require('url')
    , joi = require('joi');

var BBT = {
  types: {
    //Basic types
    BBT_Any: 'any',
    BBT_Number: 'number',
    BBT_String: 'string',
    BBT_Boolean: 'boolean',
    BBT_Object: 'object',
    BBT_Function: 'function',
    BBT_Array: 'array',
    //Constrained types
    BBT_Alpha: 'alphabetic',
    BBT_Alphanum: 'alphanumeric',
    BBT_Decimal: 'decimal',
    BBT_Rate: 'rate',
    BBT_Percentage: 'percentage',
    BBT_Email: 'email',
    BBT_GPS: 'gps',
    BBT_CPU: 'cpu',
    BBT_Memory: 'memory',
    BBT_NetIf: 'netif',
    BBT_Disk: 'disk',

    //Unit types (all numeric - functional)
    BBT_Temp: 'temperature',
    BBT_Humidity: 'humidity',
    BBT_BodyTemp: 'body_temp',
  },

  AttributeTypesLabels: [
    //Basic types
    'any',
    'number',
    'string',
    'boolean',
    'object',
    'function',
    'array',
    //Constrained types
    'alphabetic',
    'alphanumeric',
    'decimal',
    'rate',
    'percentage',
    'email',
    'gps',
    'cpu',
    'memory',
    'netif',
    'disk',
    //Unit types (all numeric - functional)
    'temperature',
    'humidity',
    'body_temp',
  ],

  methodNotAllowedToken: 'Method Not Allowed Error: this method is not allowed for Token based authentication! You must provide your Access and Secret Keys instead!',
}

BBT.Signer = function(keyId, secretKey) {
    if(!keyId || !secretKey) throw new Error('(BBT.Signer) Parameter Error: You must provide your key ID and your secret key!');
    this.keyId = keyId; 
    this.sKey = secretKey; 
}

BBT.Signer.prototype.getHeader = function (name, headers) {
    var result, re, match
    Object.keys(headers).forEach(function (key) {
        re = new RegExp(name, 'i')
        match = key.match(re)
        if (match) result = headers[key]
    })
    return result
}
var getHeader = BBT.Signer.prototype.getHeader

BBT.Signer.prototype.setHeader = function (name, value, headers, override) {
    if (override === undefined) override = true;
    if (override || !this.hasHeader(name, headers)) headers[name] = value;
    else headers[this.hasHeader(name, headers)] += ',' + value;
    return;
}
var setHeader = BBT.Signer.prototype.setHeader

BBT.Signer.prototype.hasHeader = function (header, headers) {
    var headers = Object.keys(headers);
    var lheaders = headers.map(function (h) {return h.toLowerCase()});
    
    header = header.toLowerCase();
    for (var i = 0; i<lheaders.length; i++) {
        if (lheaders[i] === header) return headers[i];
    }
    return false
}
var hasHeader = BBT.Signer.prototype.hasHeader

  
BBT.Signer.prototype.sign = function(options) {
    var headers = options.headers || {};
    options.headers = headers;
    var http_verb = options.method || 'GET';
    http_verb = http_verb.toUpperCase();
    options.method = http_verb;
    if(!options.url) throw new Error('Missing required url parameter');
    var uri = options.url.path;
    
    //Date is a mandatory header, add it if it does not exist
    if (!getHeader('Date', headers))
        setHeader('Date', new Date().toUTCString(), headers);
    
    var content_md5 = getHeader('Content-MD5', headers) || '';
    var content_type = getHeader('Content-type', headers) || '';
    var date = getHeader('Date', headers) || '';

    //content MD5 is mandatory for Post/Put requests
    if((http_verb == 'POST' || http_verb == 'PUT') && (content_md5 == '') ) throw new Error('(Signer.sign) Content-MD5 header required for POST and PUT methods');
    
    var stringToSign = http_verb + '\n' + content_md5 + '\n' + content_type + '\n' + date + '\n' + uri;

    var signature = crypto.createHmac('sha1', this.sKey).update(stringToSign).digest('base64');
    
    //Format : 'Authorization: key_id:signature'
    setHeader('Authorization', this.keyId + ':' + signature, headers);

    return true;
}

BBT.Signer.prototype.getSignature = function(toSign) {
    var signature = crypto.createHmac('sha1', this.sKey).update(toSign).digest('base64');
    return {auth: this.keyId + ':' + signature};
}

BBT.Connector = function(options) {
    this.keyId = null;
    this.secretKey = null;
    this.port = null;
    this.hostname = null;
    this.protocol = null;

    if (options.keyId && options.secretKey) {
        this.keyId = options.keyId;
        this.secretKey = options.secretKey;
        this.authType = "apikey";
        this.signer = new BBT.Signer(this.keyId, this.secretKey);
    }else if(options.token) {
        this.token = options.token;
        this.authType = "token";
    } else {
        throw new Error('(BBT.Connector) Parameter Error: You must provide an authentication token or your API access and secret keys!');
    }
    
    this.protocol = options.protocol || 'http';
    if(this.protocol.toLowerCase() !== 'http' && this.protocol.toLowerCase() !== 'https') throw new Error('Unsupported protocol ' + this.protocol);
    this.hostname = options.hostname || 'api.beebotte.com';
    if(this.protocol.toLowerCase() === 'http') this.port = 80; else this.port = 443; 
    if(options.port) this.port = options.port;

    this.validateData = function(params, schema, validator) {
        var err = null;
        if(validator) {
            err = validator(params, schema);
            if(err) return err;
        }else {
            err = joi.validate(params, schema);
            if(err) return err;
        }

        return null;
    }

    this.deleteData = function(uri, query, callback) {
        if(query) uri = uri + '?' + querystring.stringify(query);
        options = {
            url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
            method: 'DELETE',
        }

        this.signer.sign(options);

        request(options, function (error, response, body) {
            if(error) callback(error);
            if (!error && response.statusCode == 200) {
                var retval 
                try{
                    retval = JSON.parse(body);
                } catch (e) {
                    retval = body
                }
                callback(null, retval);
            }else {
                callback(body);
            }
        });
    }

    this.getData = function(uri, query, callback) {
        if(query) uri = uri + '?' + querystring.stringify(query);
        options = {
            url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
            method: 'GET',
        }

        if ( this.authType === 'token' ) {
          options.headers = {'X-Auth-Token': this.token};
        } else {
          this.signer.sign(options);
        }

        request(options, function (error, response, body) {
            if(error) callback(error);
            if (!error && response.statusCode == 200) {
                var retval
                try{
                    retval = JSON.parse(body);
                } catch (e) {
                    retval = body
                }
                callback(null, retval);
            }else {
                callback(body);
            }
        });
    }

    this.postData = function(uri, body, callback) {
        options = {
            url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
            method: 'POST',
            body: body
        }

        if ( this.authType === 'token' ) {
          options.headers = {
            'Content-Type': 'application/json',
            'X-Auth-Token': this.token
          };
        } else {
          options.headers = {
            'Content-Type': 'application/json',
            'Content-MD5': crypto.createHash('md5').update(body, 'utf8').digest('base64'),
          };
          this.signer.sign(options);
        }

        request(options, function (error, response, body) {
            if(error) callback(error);
            if (!error && response.statusCode == 200) {
                var retval 
                try{
                    retval = JSON.parse(body);
                } catch (e) {
                    retval = body
                }
                callback(null, retval);
            }else {
                callback(body);
            }
        });
    }
}

var readPublicResourceSchema = {
    owner: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    limit: joi.number().integer().min(1).max(2000).optional(),
    source: joi.string().optional().valid('raw', 'hour-stats', 'day-stats'),
    'time-range': joi.string().optional(),
    'start-time': joi.string().optional(),
    'end-time': joi.string().optional(),
    filter: joi.string().optional(),
    'sample-rate': joi.number().integer().min(1).max(10000).optional(),
};

//{channel, resource, type}
BBT.Connector.prototype.readPublic = function(params, callback) {
  var self = this;
  joi.validate(params, readPublicResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var query_opts = { limit: (params.limit || 750) };
    if(params.source) query_opts.source = params.source;
    if( params['time-range'] ) query_opts['time-range'] = params['time-range'];
    if( params['start-time'] ) query_opts['start-time'] = params['start-time'];
    if( params['end-time'] ) query_opts['end-time'] = params['end-time'];
    if( params['filter'] ) query_opts['filter'] = params['filter'];
    if( params['sample-rate'] ) query_opts['sample-rate'] = params['sample-rate'];

    var options = {
      url: url.parse(self.protocol + '://' + self.hostname + ':' + self.port.toString() + '/v1/public/data/read/' + params.owner + '/' + params.channel + '/' + params.resource + '?' +
        querystring.stringify(query_opts)),
      method: 'GET'
    }
    
    request(options, function (error, response, body) {
      if(error) callback(error);
      if (!error && response.statusCode == 200) {
        var retval 
        try{
            retval = JSON.parse(body);
        } catch (e) {
            retval = body
        }
        callback(null, retval);
      }else {
        callback(body);
      }
    });
  });
}

//{channel, resource, type}
BBT.Connector.prototype.readPublicResource = function(params, callback) {
  return thi.readPublic(params, callback);
}

var readResourceSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    limit: joi.number().integer().min(1).max(2000).optional(),
    source: joi.string().optional().valid('raw', 'hour-stats', 'day-stats'),
    'time-range': joi.string().optional(),
    'start-time': joi.string().optional(),
    'end-time': joi.string().optional(),
    filter: joi.string().optional(),
    'sample-rate': joi.number().integer().min(1).max(10000).optional(),
};
//{channel, resource, type}
BBT.Connector.prototype.read = function(params, callback) {
  var self = this;
  joi.validate(params, readResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var query_opts = { limit: (params.limit || 750) };
    if(params.source) query_opts.source = params.source;
    if( params['time-range'] ) query_opts['time-range'] = params['time-range'];
    if( params['start-time'] ) query_opts['start-time'] = params['start-time'];
    if( params['end-time'] ) query_opts['end-time'] = params['end-time'];
    if( params['filter'] ) query_opts['filter'] = params['filter'];
    if( params['sample-rate'] ) query_opts['sample-rate'] = params['sample-rate'];
    
    self.getData('/v1/data/read/' + params.channel + '/' + params.resource, query_opts, callback);
  });
}

BBT.Connector.prototype.readResource = function(params, callback) {
  return this.read(params, callback);
}

var writeResourceSchema = joi.object().keys({
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    ts: joi.number().optional(),
    data: joi.any().required(),
});
//{channel, resource, type, data}
BBT.Connector.prototype.write = function(params, callback) {
  var self = this;
  joi.validate(params, writeResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var body = {data: params.data};
    if( params.ts ) body.ts = params.ts;
    var bodystr = JSON.stringify(body);
    self.postData('/v1/data/write/' + params.channel + '/' + params.resource , bodystr, callback);
  });
}

BBT.Connector.prototype.writeResource = function(params, callback) {
  return this.write(params, callback);
}

var writeBulkSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    records: joi.array().includes(joi.object({
        resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
        ts: joi.number().integer().optional(),
        data: joi.any().required()
    }))
};
//{channel, resource, type, data}
BBT.Connector.prototype.writeBulk = function(params, callback) {
  var self = this;
  joi.validate(params, writeBulkSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var bodystr = JSON.stringify({records: params.records});
    self.postData('/v1/data/write/' + params.channel, bodystr, callback);
  });
}

var publishSchema = {
    channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(30).required(),
    resource: joi.string().min(2).max(30).required(),
    data: joi.any().required(),
    source: joi.string().max(30).optional()
}

BBT.Connector.prototype.publish = function(params, callback) {
  var self = this;
  joi.validate(params, publishSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var body = {data: params.data};
    if( params.source ) body.source = params.source;
    var bodystr = JSON.stringify(body);

    self.postData('/v1/data/publish/' + params.channel + '/' + params.resource, bodystr, callback);
  });
}

var publishBulkSchema = {
    channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(30).required(),
    records: joi.array().includes(joi.object({
        resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
        data: joi.any().required()
    }))
};
//{channel, resource, type, data}
BBT.Connector.prototype.publishBulk = function(params, callback) {
  var self = this;
  joi.validate(params, publishBulkSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var bodystr = JSON.stringify({records: params.records});
    self.postData('/v1/data/publish/' + params.channel, bodystr, callback);
  });
}

var getUserConnectionSchema = {
  userid: joi.string().optional(),
  sid: joi.string().optional(),
};

//{user id, session id }
BBT.Connector.prototype.getUserConnections = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  } else if( arguments.length === 1 ) {
    callback = params; //one argument is provided, it MUST be the callback
    self.getData('/v1/connections', null, callback);    
  }else {
    joi.validate(params, getUserConnectionSchema, function(err, value) {
      if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});
      if( params.userid ) {
        self.getData('/v1/connections/' + params.userid, (params.sid)? {sid: params.sid}: null, callback);
      }else {
        self.getData('/v1/connections', null, callback);
      }
    });
  }
}

var dropUserConnectionSchema = {
  userid: joi.string().required(),
  sid: joi.string().optional(),
};

BBT.Connector.prototype.dropUserConnection = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  } 
  joi.validate(params, dropUserConnectionSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    self.deleteData('/v1/connections/drop/' + params.userid, (params.sid)? {sid: params.sid}: null, callback);
  });
}

var addResourceSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.object({
        name: joi.string().regex(/^\w+$/).min(2).max(30).required(),
        label: joi.string().max(30).optional(),
        description: joi.string().optional(),
        vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
    }).required()
};
/*
 * {channel, resource: {name, description, type, vtype, ispublic}}
 */
BBT.Connector.prototype.addResource = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  } 
  joi.validate(params, addResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    var bodystr = JSON.stringify(params.resource);
    self.postData('/v1/channels/' + params.channel + '/resources', bodystr, callback);
  });
}

var getResourceSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
}

BBT.Connector.prototype.getResource = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  } 
  joi.validate(params, getResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    if( !params.resource || params.resource === '*' ) {
      return self.getData('/v1/channels/' + params.channel + '/resources', null, callback);
    }else {
      self.getData('/v1/channels/' + params.channel + '/resources/' + params.resource, null, callback);
    }
  });
}

var deleteResourceSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(30).required(),
}

BBT.Connector.prototype.deleteResource = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  }
  joi.validate(params, deleteResourceSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    self.deleteData('/v1/channels/' + params.channel + '/resources/' + params.resource, null, callback);
  });
}

var addChannelSchema = {
    name: joi.string().regex(/^\w+$/).min(2).max(30).required(),
    label: joi.string().max(30).optional(),
    description: joi.string().optional(),
    ispublic: joi.boolean().optional(),
    resources: joi.array().includes({
        name: joi.string().regex(/^\w+$/).min(2).max(30).required(),
        label: joi.string().max(30).optional(),
        description: joi.string().optional(),
        vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
    }).required(),
}

BBT.Connector.prototype.addChannel = function(params, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  }
  joi.validate(params, addChannelSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    //The schema is valid, now ensure that resource names are different
    for(var i in params.resources) {
        for(var j = parseInt(i) + 1; j < params.resources.length; j ++) {
            if(params.resources[i].name === params.resources[j].name) return callback({error: {message: '(BBT.Connector.addChannel) Parameter error: a channel must not have resources with the same name!', code: 11}});
        }
    }

    var bodystr = JSON.stringify(params);
    self.postData('/v1/channels', bodystr, callback);
  });
}

var getChannelSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
}

BBT.Connector.prototype.getChannel = function(channel, callback) {
  var self = this;
  //Two cases: the channel is undefined or equal to "*"
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  } else if( !channel || channel === '*') {
    return self.getData('/v1/channels', null, callback);
  } else {
    joi.validate({channel: channel}, getChannelSchema, function(err, value) {
      if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

      self.getData('/v1/channels/' + channel, null, callback);
    });
  }
}

var deleteChannelSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
}

BBT.Connector.prototype.deleteChannel = function(channel, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  }
  joi.validate({channel: channel}, deleteChannelSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    self.deleteData('/v1/channels/' + channel, null, callback);
  });
}

BBT.Connector.prototype.sign = function(str) {
    return this.signer.getSignature(str);
}

var regenerateChannelTokenSchema = {
    channel: joi.string().regex(/^\w+$/).min(2).max(30).required(),
}

BBT.Connector.prototype.regenerateChannelToken = function(channel, callback) {
  var self = this;
  if ( self.authType === 'token' ) {
    return callback({error: {message: BBT.methodNotAllowedToken, code: 11}});
  }
  joi.validate({channel: channel}, regenerateChannelTokenSchema, function(err, value) {
    if(err) return callback({error: {message: JSON.stringify(err.details), code: 11}});

    self.getData('/v1/channels/' + channel + '/token/regenerate', null, callback);
  });
}

module.exports = BBT.Connector;
