// Copyright 2013-2015 Beebotte. All rights reserved.

'use strict'

/**
 * Reference implementation of Beebotte's REST requests signing and authentication.
 */
var crypto = require('crypto')
var request = require('request')
var querystring = require('querystring')
var url = require('url')
var joi = require('joi')
var extend = require('extend')
var version = require('../package.json').version

function getUseragentString () {
  return 'beebotte node.js SDK v' + version
}

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

  TriggerTypes: [
    'connect',
    'disconnect',
    'subscribe',
    'unsubscribe',
    'join',
    'leave',
    'publish',
    'write'
  ],

  ActionTypes: [
    'publish',
    'write',
    'sms', // reserved for future use
    'email', // reserved for future use
    'webhook',
    'fcm'
  ],

  AclTypes: [
    'data:read',
    'data:write',
    'admin:connection:read',
    'admin:connection:write',
    'admin:channel:read',
    'admin:channel:write',
    'admin:beerule:read',
    'admin:beerule:write',
    'admin:iam:read',
    'admin:iam:write'
  ],

  AclDataTypes: [
    'data:read',
    'data:write',
  ],

  iamTokenPrefix: 'iamtkn',

  methodNotAllowedToken: 'Method Not Allowed Error: this method is not allowed for Token based authentication! You must provide your Access and Secret Keys instead!',
}

BBT.Signer = function (apiKey, secretKey) {

  if (!apiKey || !secretKey) {
    throw new Error('(BBT.Signer) Parameter Error: You must provide your key ID and your secret key!')
  }

  this.apiKey = apiKey
  this.sKey = secretKey
}

BBT.Signer.prototype.getHeader = function (name, headers) {
    var result, re, match

    Object.keys(headers).forEach(function (key) {
        re = new RegExp(name, 'i')
        match = key.match(re)
        if (match) {
          result = headers[key]
        }
    })

    return result
}

var getHeader = BBT.Signer.prototype.getHeader

BBT.Signer.prototype.setHeader = function (name, value, headers, override) {
    if (override === undefined) {
      override = true
    }
    if (override || !this.hasHeader(name, headers)) {
      headers[name] = value
    } else {
      headers[this.hasHeader(name, headers)] += ',' + value
    }

    return
}

var setHeader = BBT.Signer.prototype.setHeader

BBT.Signer.prototype.hasHeader = function (header, headers) {
  var headers = Object.keys(headers);
  var lheaders = headers.map(function (h) {
    return h.toLowerCase()
  })

  header = header.toLowerCase()

  for (var i = 0; i<lheaders.length; i++) {
    if (lheaders[i] === header) {
      return headers[i]
    }
  }
  return false
}

var hasHeader = BBT.Signer.prototype.hasHeader


BBT.Signer.prototype.sign = function (options) {

  var headers = options.headers || {}
  options.headers = headers;
  var http_verb = (options.method || 'GET').toUpperCase()
  options.method = http_verb;

  if (!options.url) {
    throw new Error('Missing required url parameter')
  }

  var uri = options.url.path;

  //Date is a mandatory header, add it if it does not exist
  if (!getHeader('Date', headers)) {
    setHeader('Date', new Date().toUTCString(), headers);
  }

  var content_md5 = getHeader('Content-MD5', headers) || '';
  var content_type = getHeader('Content-type', headers) || '';
  var date = getHeader('Date', headers) || '';

  //content MD5 is mandatory for Post/Put requests
  if ((http_verb == 'POST' || http_verb == 'PUT') && (content_md5 == '')) {
    throw new Error('(Signer.sign) Content-MD5 header required for POST and PUT methods');
  }

  var stringToSign = http_verb + '\n' + content_md5 + '\n' + content_type + '\n' + date + '\n' + uri;

  var signature = crypto.createHmac('sha1', this.sKey)
  .update(stringToSign)
  .digest('base64');

  //Format : 'Authorization: key_id:signature'
  setHeader('Authorization', this.apiKey + ':' + signature, headers);

  return true;
}

BBT.Signer.prototype.getSignature = function (toSign) {
  var signature = crypto.createHmac('sha1', this.sKey)
  .update(toSign)
  .digest('base64');

  return {auth: this.apiKey + ':' + signature};
}

BBT.Connector = function (options) {

  // For backward compatibility continue to accept 'keyId'
  this.apiKey = options.apiKey || options.keyId;
  this.secretKey = null;
  this.port = null;
  this.hostname = null;
  this.protocol = null;

  if (this.apiKey && options.secretKey) {
    this.secretKey = options.secretKey;
    this.authType = "apikey";
    this.signer = new BBT.Signer(this.apiKey, this.secretKey);
  } else if(options.token) {
    if (options.token.indexOf(BBT.iamTokenPrefix) === 0) {
      this.token = options.token;
      this.authType = "iamtoken";
    } else {
      this.token = options.token;
      this.authType = "token";
    }
  } else {
    throw new Error('(BBT.Connector) Parameter Error: You must provide an authentication token or your API access and secret keys!');
  }

  this.protocol = options.protocol || 'http';

  if (this.protocol.toLowerCase() !== 'http' && this.protocol.toLowerCase() !== 'https') {
    throw new Error('Unsupported protocol ' + this.protocol)
  }

  this.hostname = options.hostname || 'api.beebotte.com';

  if (this.protocol.toLowerCase() === 'http') {
    this.port = 80
  } else {
    this.port = 443
  }

  if (options.port) {
    this.port = options.port
  }

  this.validateData = function (params, schema, validator) {
    var err = null;

    if (validator) {
      err = validator(params, schema);
      if (err) {
        return err
      }
    } else {
      err = joi.validate(params, schema);
      if (err) {
        return err
      }
    }

    return null;
  }

  this.deleteData = function (uri, query, callback) {
    if (query) {
      uri = uri + '?' + querystring.stringify(query)
    }

    options = {
      url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
      method: 'DELETE',
      headers: {
        'User-Agent': getUseragentString()
      }
    }

    if (this.authType === 'token') {
      options.headers['X-Auth-Token'] = this.token;
    } else if (this.authType === 'iamtoken') {
      options.headers['X-Auth-Token'] = this.token;
    } else {
      this.signer.sign(options);
    }

    request(options, function (error, response, body) {
      if (error) {
        callback(error)
      }

      if (!error && response.statusCode == 200) {
        var retval
        try {
          retval = JSON.parse(body);
        } catch (e) {
          retval = body
        }
        callback(null, retval);
      } else {
        callback(body);
      }
    });
  }

  this.getData = function (uri, query, callback) {
    if (query) {
      uri = uri + '?' + querystring.stringify(query)
    }

    options = {
      url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
      method: 'GET',
      headers: {
        'User-Agent': getUseragentString()
      }
    }

    if (this.authType === 'token') {
      options.headers['X-Auth-Token'] = this.token;
    } else if (this.authType === 'iamtoken') {
      options.headers['X-Auth-Token'] = this.token;
    } else {
      this.signer.sign(options);
    }

    request(options, function (error, response, body) {
      if (error) {
        callback(error);
      }

      if (!error && response.statusCode == 200) {
        var retval
        try {
          retval = JSON.parse(body);
        } catch (e) {
          retval = body
        }
        callback(null, retval);
      } else {
        callback(body);
      }
    });
  }

  this.postData = function (uri, body, callback) {
    options = {
      url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
      method: 'POST',
      headers: {
        'User-Agent': getUseragentString(),
        'Content-Type': 'application/json'
      },
      body: body
    }

    if (this.authType === 'token') {
      options.headers['X-Auth-Token'] = this.token
    } else if (this.authType === 'iamtoken') {
      options.headers['X-Auth-Token'] = this.token
    } else {
      options.headers['Content-MD5'] = crypto.createHash('md5').update(body, 'utf8').digest('base64')
      this.signer.sign(options);
    }

    request(options, function (error, response, body) {
      if (error) {
        callback(error)
      }

      if (!error && response.statusCode <= 210) {
        var retval
        try {
          retval = JSON.parse(body);
        } catch (e) {
          retval = body
        }
        callback(null, retval);
      } else {
        callback(body);
      }
    });
  }
}

var readPublicResourceSchema = {
  owner: joi.string().regex(/^\w+$/).min(2).max(30).required(),
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  limit: joi.number().integer().min(1).max(50000).optional(),
  source: joi.string().optional().valid('raw', 'hour-stats', 'day-stats'),
  'time-range': joi.string().optional(),
  'start-time': joi.string().optional(),
  'end-time': joi.string().optional(),
  filter: joi.string().optional(),
  'sample-rate': joi.number().integer().min(1).max(10000).optional(),
};

//{channel, resource, type}
BBT.Connector.prototype.readPublic = function (params, callback) {
  var self = this;
  joi.validate(params, readPublicResourceSchema, function (err, value) {
    if (err) {
      return callback({
        error: {
          message: JSON.stringify(err.details),
          code: 11
        }
      })
    }

    var query_opts = {limit: (params.limit || 750)};

    if (params.source) {
      query_opts.source = params.source
    }
    if (params['time-range']) {
      query_opts['time-range'] = params['time-range']
    }
    if (params['start-time']) {
      query_opts['start-time'] = params['start-time']
    }
    if (params['end-time']) {
      query_opts['end-time'] = params['end-time']
    }
    if (params['filter']) {
      query_opts['filter'] = params['filter']
    }
    if (params['sample-rate']) {
      query_opts['sample-rate'] = params['sample-rate']
    }

    var options = {
      url: url.parse(self.protocol + '://' + self.hostname + ':' + self.port.toString() + '/v1/public/data/read/' + params.owner + '/' + params.channel + '/' + params.resource + '?' +
        querystring.stringify(query_opts)),
      method: 'GET'
    }

    request(options, function (error, response, body) {
      if (error) {
        callback(error)
      }
      if (!error && response.statusCode == 200) {
        var retval
        try {
          retval = JSON.parse(body);
        } catch (e) {
          retval = body
        }
        callback(null, retval);
      } else {
        callback(body);
      }
    })
  })
}

//{channel, resource, type}
BBT.Connector.prototype.readPublicResource = function (params, callback) {
  return thi.readPublic(params, callback);
}

var readResourceSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  limit: joi.number().integer().min(1).max(50000).optional(),
  source: joi.string().optional().valid('raw', 'hour-stats', 'day-stats'),
  'time-range': joi.string().optional(),
  'start-time': joi.string().optional(),
  'end-time': joi.string().optional(),
  filter: joi.string().optional(),
  'sample-rate': joi.number().integer().min(1).max(10000).optional(),
};
//{channel, resource, type}
BBT.Connector.prototype.read = function (params, callback) {
  var self = this;
  joi.validate(params, readResourceSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var query_opts = {limit: (params.limit || 750)}
    if (params.source) {
      query_opts.source = params.source
    }
    if (params['time-range']) {
      query_opts['time-range'] = params['time-range']
    }
    if (params['start-time']) {
      query_opts['start-time'] = params['start-time']
    }
    if (params['end-time']) {
      query_opts['end-time'] = params['end-time']
    }
    if (params['filter']) {
      query_opts['filter'] = params['filter']
    }
    if (params['sample-rate']) {
      query_opts['sample-rate'] = params['sample-rate']
    }

    self.getData('/v1/data/read/' + params.channel + '/' + params.resource, query_opts, callback);
  })
}

BBT.Connector.prototype.readResource = function (params, callback) {
  return this.read(params, callback);
}

var writeResourceSchema = joi.object().keys({
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  ts: joi.number().optional(),
  data: joi.any().required(),
});

//{channel, resource, type, data}
BBT.Connector.prototype.write = function (params, callback) {
  var self = this;
  joi.validate(params, writeResourceSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var body = {data: params.data};
    if (params.ts) {
      body.ts = params.ts
    }
    var bodystr = JSON.stringify(body);
    self.postData('/v1/data/write/' + params.channel + '/' + params.resource , bodystr, callback);
  });
}

BBT.Connector.prototype.writeResource = function (params, callback) {
  return this.write(params, callback);
}

var writeBulkSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  records: joi.array().items(joi.object({
    resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    ts: joi.number().integer().optional(),
    data: joi.any().required()
  }))
};

//{channel, resource, type, data}
BBT.Connector.prototype.writeBulk = function (params, callback) {
  var self = this;
  joi.validate(params, writeBulkSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var bodystr = JSON.stringify({records: params.records});
    self.postData('/v1/data/write/' + params.channel, bodystr, callback);
  });
}

var deleteRecordSchema = joi.object().keys({
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  _id: joi.string().min(2).max(48).required()
})

//{channel, resource, _id}
BBT.Connector.prototype.delete = function(params, callback) {
  var self = this
  joi.validate(params, deleteRecordSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var query = {
      _id: params._id
    }

    self.deleteData('/v1/data/delete/' + params.channel + '/' + params.resource, query, callback)
  })
}

var updateResourceSchema = joi.object().keys({
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  _id: joi.string().min(2).max(48).required(),
  ts: joi.number().optional(),
  data: joi.any().required(),
})

//{channel, resource, _id, ts, data}
BBT.Connector.prototype.update = function(params, callback) {
  var self = this
  joi.validate(params, updateResourceSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var body = {
      _id: params._id,
      data: params.data
    }

    if (params.ts) {
      body.ts = params.ts
    }

    var bodystr = JSON.stringify(body)
    self.postData('/v1/data/update/' + params.channel + '/' + params.resource, bodystr, callback)
  })
}

var publishSchema = {
  channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(64).required(),
  resource: joi.string().min(2).max(64).required(),
  data: joi.any().required(),
  source: joi.string().max(30).optional()
}

BBT.Connector.prototype.publish = function (params, callback) {
  var self = this;
  joi.validate(params, publishSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var body = {data: params.data};
    if (params.source) {
      body.source = params.source
    }
    var bodystr = JSON.stringify(body);

    self.postData('/v1/data/publish/' + params.channel + '/' + params.resource, bodystr, callback);
  });
}

var publishBulkSchema = {
  channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(64).required(),
  records: joi.array().items(joi.object({
    resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    data: joi.any().required()
  }))
};

//{channel, resource, type, data}
BBT.Connector.prototype.publishBulk = function (params, callback) {
  var self = this;
  joi.validate(params, publishBulkSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var bodystr = JSON.stringify({records: params.records});
    self.postData('/v1/data/publish/' + params.channel, bodystr, callback);
  });
}

var getUserConnectionSchema = {
  userid: joi.string().optional(),
  protocol: joi.string().optional(),
  sid: joi.string().optional()
};

//{user id, session id }
BBT.Connector.prototype.getUserConnections = function(params, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  } else if (arguments.length === 1) {
    callback = params; //one argument is provided, it MUST be the callback
    self.getData('/v1/connections', null, callback);
  } else {
    joi.validate(params, getUserConnectionSchema, function (err, value) {
      if (err) {
        return callback({error: {
          message: JSON.stringify(err.details),
          code: 11
        }})
      }

      var query = {}

      if (params.sid) {
        query.sid = params.sid
      }

      if (params.protocol) {
        query.protocol = params.protocol
      }

      if ( params.userid ) {
        self.getData('/v1/connections/' + params.userid, query, callback);
      } else {
        self.getData('/v1/connections', query, callback);
      }
    })
  }
}

var dropUserConnectionSchema = {
  userid: joi.string().required(),
  protocol: joi.string().optional(),
  sid: joi.string().optional(),
};

BBT.Connector.prototype.dropUserConnection = function(params, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  }

  joi.validate(params, dropUserConnectionSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var query = {}

    if (params.sid) {
      query.sid = params.sid
    }

    if (params.protocol) {
      query.protocol = params.protocol
    }

    self.deleteData('/v1/connections/drop/' + params.userid, query, callback);
  });
}

var addResourceSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.object({
    name: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    label: joi.string().max(64).optional(),
    description: joi.string().optional(),
    vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
    sendOnSubscribe: joi.boolean().optional(),
  }).required()
};

/*
 * {channel, resource: {name, description, type, vtype, ispublic}}
 */
BBT.Connector.prototype.addResource = function (params, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  }

  joi.validate(params, addResourceSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    var bodystr = JSON.stringify(params.resource);
    self.postData('/v1/channels/' + params.channel + '/resources', bodystr, callback);
  });
}

var getResourceSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^(\w\w+|\*)$/).max(64).optional(),
}

BBT.Connector.prototype.getResource = function (params, callback) {
  var self = this;
  params = params || {}

  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }});
  } else {
    params.resource = params.resource || '*'
    joi.validate(params, getResourceSchema, function (err, value) {
      if (err) {
        return callback({error: {message: JSON.stringify(err.details), code: 11}});
      }

      if (!params.resource || params.resource === '*') {
        return self.getData('/v1/channels/' + params.channel + '/resources', null, callback);
      } else {
        self.getData('/v1/channels/' + params.channel + '/resources/' + params.resource, null, callback);
      }
    })
  }
}

var deleteResourceSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
}

BBT.Connector.prototype.deleteResource = function (params, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }});
  }

  joi.validate(params, deleteResourceSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    self.deleteData('/v1/channels/' + params.channel + '/resources/' + params.resource, null, callback);
  });
}

var addChannelSchema = {
  name: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  label: joi.string().max(64).optional(),
  description: joi.string().optional(),
  ispublic: joi.boolean().optional(),
  resources: joi.array().items({
    name: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    label: joi.string().max(64).optional(),
    description: joi.string().optional(),
    vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
    sendOnSubscribe: joi.boolean().optional(),
  }).required(),
}

BBT.Connector.prototype.addChannel = function (params, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  }

  joi.validate(params, addChannelSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    //The schema is valid, now ensure that resource names are different
    for (var i in params.resources) {
      for (var j = parseInt(i) + 1; j < params.resources.length; j ++) {
        if (params.resources[i].name === params.resources[j].name) {
          return callback({error: {
            message: '(BBT.Connector.addChannel) Parameter error: a channel must not have resources with the same name!',
            code: 11
          }})
        }
      }
    }

    var bodystr = JSON.stringify(params);
    self.postData('/v1/channels', bodystr, callback);
  });
}

var getChannelSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
}

BBT.Connector.prototype.getChannel = function (channel, callback) {
  var self = this;
  if (channel instanceof Function) {
    callback = channel
    channel = '*'
  }

  //Two cases: the channel is undefined or equal to "*"
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  } else if( !channel || channel === '*') {
    return self.getData('/v1/channels', null, callback);
  } else {
    joi.validate({channel: channel}, getChannelSchema, function (err, value) {
      if (err) {
        return callback({error: {
          message: JSON.stringify(err.details),
          code: 11
        }})
      }

      self.getData('/v1/channels/' + channel, null, callback);
    })
  }
}

var deleteChannelSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
}

BBT.Connector.prototype.deleteChannel = function (channel, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }});
  }

  joi.validate({channel: channel}, deleteChannelSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    self.deleteData('/v1/channels/' + channel, null, callback);
  })
}

BBT.Connector.prototype.sign = function (str) {
  return this.signer.getSignature(str);
}

var regenerateChannelTokenSchema = {
  channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
}

BBT.Connector.prototype.regenerateChannelToken = function (channel, callback) {
  var self = this;
  if (self.authType === 'token') {
    return callback({error: {
      message: BBT.methodNotAllowedToken,
      code: 11
    }})
  }

  joi.validate({channel: channel}, regenerateChannelTokenSchema, function (err, value) {
    if (err) {
      return callback({error: {
        message: JSON.stringify(err.details),
        code: 11
      }})
    }

    self.getData('/v1/channels/' + channel + '/token/regenerate', null, callback);
  });
}

//////////////////////////////////////////////////////////////////////
//////////////////// BeeRules Specific Operations ////////////////////
//////////////////////////////////////////////////////////////////////

var getBeerulesQuerySchema = {
  type: joi.string().valid(BBT.ActionTypes).optional(),
  event: joi.string().valid(BBT.TriggerTypes).optional(),
  channel: joi.string().regex(/^(\*|(private-)?(\w\w+))$/).optional().min(2).max(64),
  resource: joi.string().regex(/^(\*|\w\w+)$/).optional().min(2).max(64)
}

/**
 * Returns all Beerules of the user satisfying query on the rule trigger.
 *
 * @public
 * @param {Object} query optional filter query on the Beerules to return
 * @param {String} query.type the type of the Beerule trigger
 * @param {String} query.channel the Beerule trigger channel
 * @param {String} query.resource the Beerule trigger resource
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.getBeerules = function(query, callback) {
  var self = this

  if (!callback) {
    callback = query
    query = null
  }

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  if (query) {
    joi.validate(query, getBeerulesQuerySchema, function (err, value) {
      if (err) {
        return callback({
          error: {
            message: JSON.stringify(err.details),
            code: 11
          }
        })
      }

      self.getData('/v1/beerules', query, callback)
    })
  } else {
    return self.getData('/v1/beerules', null, callback)
  }
}

/**
 * Returns a Beerule given by its identifier.
 *
 * @public
 * @param {String} beeruleid identifier of the Beerule
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.getBeerule = function (beeruleid, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  self.getData('/v1/beerules/' + beeruleid, null, callback)
}

/**
 * Deletes a Beerule given by its identifier.
 *
 * @public
 * @param {String} beeruleid identifier of the Beerule
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.deleteBeerule = function (beeruleid, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  self.deleteData('/v1/beerules/' + beeruleid, null, callback)
}

/**
 * Sets Beerule status (to enabled or disabled) given by its identifier.
 *
 * @public
 * @param {String} beeruleid identifier of the Beerule
 * @param {Boolean} status indicated if the Beerule is to be enabled or disabled
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.setBeeruleStatus = function (beeruleid, status, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  var bodystr = JSON.stringify({enabled: !!status})
  self.postData('/v1/beerules/' + beeruleid + '/setstatus', bodystr, callback)
}

var beeruleInvocationSchema = {
  channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(64).required(),
  resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
  ispublic: joi.boolean().optional(),
  clientid: joi.string().optional(),
  data: joi.any().optional(),
  debug: joi.boolean().optional()
}

/**
 * Invokes a Beerule given by its identifier.
 *
 * @public
 * @param {String} beeruleid identifier of the Beerule
 * @param {Object} body the invocation call body
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.invokeBeerule = function (beeruleid, body, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  joi.validate(body, beeruleInvocationSchema, function (err, value) {
    if (err) {
      return callback({
        error: {
          message: JSON.stringify(err.details),
          code: 11
        }
      })
    }

    var bodystr = JSON.stringify(body)
    self.postData('/v1/beerules/' + beeruleid + '/invoke', bodystr, callback)
  })
}

var genericBeeruleSchema = {
  name: joi.string().min(2).max(48).required(),
  description: joi.string().optional(),
  owner: joi.string().optional(),
  trigger: joi.object({
    event: joi.string().valid(BBT.TriggerTypes).required(),
    channel: joi.string().regex(/^(\*|(private-)?(\w\w+))$/).max(64).required(),
    resource: joi.string().regex(/^(\*|\w\w+)$/).max(64).required()
  }).required(),
  condition: joi.string().optional(),
  action: {
    type: joi.string().valid(BBT.ActionTypes).required(),
  }
}

var publishBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'publish',
    channel: joi.string().regex(/^(private-)?\w+$/).min(2).max(64).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    value: joi.string().optional()
  }).required()
})

var writeBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'write',
    channel: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    resource: joi.string().regex(/^\w+$/).min(2).max(64).required(),
    value: joi.string().optional()
  }).required()
})

var smsBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'sms',
    // TODO: validate phone number
    to: joi.string().required()
  }).required()
})

var emailBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'email',
    to: joi.string().email().required()
  }).required()
})

var webhookBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'webhook',
    endpoint: joi.string().uri().required()
  }).required()
})

var fcmBeeruleSchema = extend({}, genericBeeruleSchema, {
  action: joi.object({
    type: 'fcm',
    serverKey: joi.string().required(),
    senderID: joi.string().optional(),
    to: joi.string().required(),
    isTopic: joi.boolean().optional(),
    isNotification: joi.boolean().optional(),
    value: joi.string().optional()
  }).required()
})

var schemaSelector = {
  publish: publishBeeruleSchema,
  write: writeBeeruleSchema,
  sms: smsBeeruleSchema,
  email: emailBeeruleSchema,
  webhook: webhookBeeruleSchema,
  fcm: fcmBeeruleSchema
}

/**
 * Creates a new Beerule a described in params.
 *
 * @public
 * @param {Object} params JSON description of the Beerule to create
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.createBeerule = function (params, callback) {
  var self = this;

  if (self.authType === 'token') {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  // verify params has action and action.type keys
  if (!params.action || !params.action.type) {
    return process.nextTick(function () {
      callback({
        error: {
          message: 'Schema validation error: Beerule action type must be set to a supported value',
          code: 11
        }
      })
    })
  }

  var schemaToCheck = schemaSelector[params.action.type]

  if (!schemaToCheck) {
    return process.nextTick(function () {
      callback({
        error: {
          message: 'Schema validation error: Beerule action type must be set to a supported value',
          code: 11
        }
      })
    })
  }

  joi.validate(params, schemaToCheck, function (err, value) {
    if (err) {
      return callback({
        error: {
          message: JSON.stringify(err.details),
          code: 11
        }
      })
    }

    var bodystr = JSON.stringify(params)
    self.postData('/v1/beerules/' + params.action.type, bodystr, callback)
  })
}

//////////////////////////////////////////////////////////////////////
/////////////////// IAM TOKEN Specific Operations ////////////////////
//////////////////////////////////////////////////////////////////////

/**
 * Returns all IAMTokens of the user.
 *
 * @public
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.getIAMTokens = function(callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  return self.getData('/v1/iamtokens', null, callback)
}

/**
 * Returns an IAM Token given by its identifier.
 *
 * @public
 * @param {String} iamtokenid identifier of the IAM Token
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.getIAMTokenByID = function (iamtokenid, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  self.getData('/v1/iamtokens/' + iamtokenid, null, callback)
}

/**
 * Deletes an IAM Token given by its identifier.
 *
 * @public
 * @param {String} iamtokenid identifier of the IAM Token
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.deleteIAMToken = function (iamtokenid, callback) {
  var self = this

  if (self.authType === 'token' ) {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  self.deleteData('/v1/iamtokens/' + iamtokenid, null, callback)
}

var iamaclresource = joi.string().regex(/^((\*|(\w\w+))(\.(\*|(\w\w+)))?)$/).max(129)

var iamTokenSchema = {
  name: joi.string().min(2).max(48).required(),
  description: joi.string().optional(),
  acl: joi.array().items(joi.object({
    action: joi.string().valid(BBT.AclTypes).required(),
    resource: joi.array()
    .when(
      'action',
      {
        is: joi.string().valid(BBT.AclDataTypes),
        then: joi.array().min(1).items(iamaclresource).optional(),
        otherwise: joi.array().max(1).items(joi.string().valid('*')).optional()
      }
    )
  })).required()
}

/**
 * Creates a new IAMToken a described in params.
 *
 * @public
 * @param {Object} params JSON description of the Beerule to create
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.createIAMToken = function (params, callback) {
  var self = this;

  if (self.authType === 'token') {
    return process.nextTick(function () {
      callback({error: {message: BBT.methodNotAllowedToken, code: 11}})
    })
  }

  // verify params has acl and it is not empty
  if (!params.acl || !params.acl.length) {
    return process.nextTick(function () {
      callback({
        error: {
          message: 'Schema validation error: IAMToken must have at least one ACL rule',
          code: 11
        }
      })
    })
  }

  joi.validate(params, iamTokenSchema, function (err, value) {
    if (err) {
      return callback({
        error: {
          message: JSON.stringify(err.details),
          code: 11
        }
      })
    }

    var bodystr = JSON.stringify(params)
    self.postData('/v1/iamtokens', bodystr, callback)
  })
}

/**
 * Updates an existing IAMToken with a new set of ACL rules.
 *
 * @public
 * @param {String} iamtokenid identifier of the IAMToken to update
 * @param {Object} acl New set of ACL rules to update the IAMToken with
 * @param {function} callback the callback function
 */
BBT.Connector.prototype.updateIAMToken = function (iamtokenid, acl, callback) {
  var self = this;

  if (self.authType === 'token') {
    return process.nextTick(function () {
      callback({error: {
        message: BBT.methodNotAllowedToken,
        code: 11
      }})
    })
  }

  // verify acl is not empty
  if (!acl.length) {
    return process.nextTick(function () {
      callback({
        error: {
          message: 'Schema validation error: IAMToken must have at least one ACL rule',
          code: 11
        }
      })
    })
  }

  joi.validate(acl, iamTokenSchema.acl, function (err, value) {
    if (err) {
      return callback({
        error: {
          message: JSON.stringify(err.details),
          code: 11
        }
      })
    }

    var bodystr = JSON.stringify({
      _id: iamtokenid,
      acl: acl
    })
    self.postData('/v1/iamtokens/' + iamtokenid, bodystr, callback)
  })
}

module.exports = BBT.Connector
