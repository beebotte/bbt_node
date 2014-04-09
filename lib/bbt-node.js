// Copyright 2013 Beebotte. All rights reserved.

/*
 * Reference implementation of Beebotte's REST requests signing and authentication.
 */
var crypto = require('crypto');
var request = require('request');
var querystring = require('querystring');
var url = require('url');
var joi = require('joi');

BBT = {
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
    //Unit types (all numeric - functional)
    BBT_Temp: 'temperature',
    BBT_Humidity: 'humidity',
    BBT_BodyTemp: 'body temperature',
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
    //Unit types (all numeric - functional)
    'temperature',
    'humidity',
    'body temperature',
  ],
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
    }else {
        throw new Error('(BBT.Connector) Parameter Error: You must provide your API access key and secret key!');
    }
    
    this.protocol = options.protocol || 'http';
    if(this.protocol.toLowerCase() !== 'http' && this.protocol.toLowerCase() !== 'https') throw new Error('Unsupported protocol ' + this.protocol);
    this.hostname = options.hostname || 'api.beebotte.com';
    if(this.protocol.toLowerCase() === 'http') this.port = 80; else this.port = 443; 
    if(options.port) this.port = options.port;

    this.signer = new BBT.Signer(this.keyId, this.secretKey);

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

    this.postData = function(uri, body, callback) {
        options = {
            url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + uri),
            method: 'POST',
            body: body,
            headers: {
                'Content-MD5': crypto.createHash('md5').update(body).digest('base64'),
                //'Content-Length': Buffer.byteLength(body),
                'Content-Type': 'application/json',
            }
        }

        this.signer.sign(options);
        
        request(options, function (error, response, body) {
            if(error) callback(error);
            if (!error && response.statusCode == 200) {
                callback(null, body);
            }else {
                callback(body, '');
            }
        });
    }
}

var readPublicResourceSchema = {
    owner: joi.string().min(2).max(30).required(),
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.string().max(30).required(),
    limit: joi.number().integer().min(1).max(250).optional(),
    source: joi.string().optional().valid('live', 'hour', 'day', 'week', 'month'),
    metric: joi.string().optional().valid('avg', 'min', 'max', 'count'),
};
//{device, resource, type}
BBT.Connector.prototype.readPublicResource = function(params, callback) {
    var err = joi.validate(params, readPublicResourceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});
    var query_opts = {owner: params.owner, device: params.device, service: params.service, resource: params.resource, limit: (params.limit || 1)};
    if(params.source && params.source !== 'live') {
      query_opts.source = params.source;
      query_opts.metric = params.metric || 'avg';
    }
    options = {
        url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + '/api/public/resource?' +
             querystring.stringify(query_opts)),
        method: 'GET'
    }
    
    request(options, function (error, response, body) {
        if(error) callback(error);
        if (!error && response.statusCode == 200) {
            callback(null, body);
        }else {
            callback(body, '');
        }
    });
}

var readResourceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.string().max(30).required(),
    limit: joi.number().integer().min(1).max(250).optional(),
    source: joi.string().optional().valid('live', 'hour', 'day', 'week', 'month'),
    metric: joi.string().optional().valid('avg', 'min', 'max', 'count'),
};
//{device, resource, type}
BBT.Connector.prototype.readResource = function(params, callback) {
    var err = this.validateData(params, readResourceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var query_opts = {device: params.device, service: params.service, resource: params.resource, limit: (params.limit || 1)};
    if(params.source && params.source !== 'live') {
      query_opts.source = params.source;
      query_opts.metric = params.metric || 'avg';
    }

    options = {
        url: url.parse(this.protocol + '://' + this.hostname + ':' + this.port.toString() + '/api/resource/read?' +
             querystring.stringify(query_opts)),
        method: 'GET'
    }
    
    this.signer.sign(options);
    
    request(options, function (error, response, body) {
        if(error) callback(error);
        if (!error && response.statusCode == 200) {
            callback(null, body);
        }else {
            callback(body, '');
        }
    });
}

var writeResourceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.string().max(30).required(),
    value: joi.any().required(),
};
//{device, resource, type, value}
BBT.Connector.prototype.writeResource = function(params, callback) {
    var err = this.validateData(params, writeResourceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});
    
    var bodystr = JSON.stringify(params);
    this.postData('/api/resource/write', bodystr, callback);
}

var writeBulkSchema = {
    device: joi.string().min(2).max(30).required(),
    data: joi.array().includes(joi.object({
        service: joi.string().max(30).required(),
        resource: joi.string().max(30).required(),
        value: joi.any().required()
    }))
};
//{device, resource, type, value}
BBT.Connector.prototype.writeBulk = function(params, callback) {
    var err = this.validateData(params, writeBulkSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);
    this.postData('/api/resource/bulk_write', bodystr, callback);
}

var addResourceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.object({
        name: joi.string().min(3).max(30).required(),
        description: joi.string().optional(),
        vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
    }).required()
};
/*
 * {device, service, resource: {name, description, type, vtype, ispublic}}
 */
BBT.Connector.prototype.addResource = function(params, callback) {
    var err = this.validateData(params, addResourceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});
    
    var bodystr = JSON.stringify(params);
    this.postData('/api/devices/add_resource', bodystr, callback);
}

var deleteResourceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.string().max(30).required(),
}

BBT.Connector.prototype.deleteResource = function(params, callback) {
    var err = this.validateData(params, deleteResourceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);
    this.postData('/api/devices/delete_resource', bodystr, callback);
}

var addServiceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.object({
        name: joi.string().max(30).required(),
        description: joi.string().optional(),
        resources: joi.array([{
            name: joi.string().max(30).required(),
            description: joi.string().optional(),
            vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
        }]).required(),
    }).required(),
}

validateServiceSchema = function(params, schema) {
    var err = joi.validate(params, schema);
    if(err) return err;
    else {
        for(var i in params.service.resources) {
            for(var j = parseInt(i) + 1; j < params.service.resources.length; j ++) {
                if(params.service.resources[i].name == params.service.resources[j].name) return {message: '(BBT.Connector.addService) Parameter error: a service must not have resources with the same name!'};
            }
        }
    }
    return null;
}

BBT.Connector.prototype.addService = function(params, callback) {
    var err = this.validateData(params, addServiceSchema, validateServiceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);
    this.postData('/api/devices/add_service', bodystr, callback);
}

var deleteServiceSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required()
}

BBT.Connector.prototype.deleteService = function(params, callback) {
    var err = this.validateData(params, deleteServiceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);
    this.postData('/api/devices/delete_service', bodystr, callback);
}

var addDeviceSchema = {
    name: joi.string().min(2).max(30).required(),
    description: joi.string().optional(),
    ispublic: joi.boolean().optional(),
    services: joi.array([{
        name: joi.string().max(30).required(),
        description: joi.string().optional(),
        resources: joi.array([{
            name: joi.string().max(30).required(),
            description: joi.string().optional(),
            vtype: joi.string().required().valid(BBT.AttributeTypesLabels),
        }]).required(),
    }]).required(),
}

validateDeviceSchema = function(params, schema) {
    var err = joi.validate(params, schema);
    if(err) return err;
    else {
        for(var i in params.services) {
            for(var j = parseInt(i) + 1; j < params.services.length; j ++) {
                if(params.services[i].name === params.services[j].name) return {error: {message: '(BBT.Connector.addDevice) Parameter error: a device must not have services with the same name!', code: 11}};
            }
            //New verify a service does not have a duplicate resource name
            var service = params.services[i];
            for(var l in service.resources) {
                for(var m = parseInt(l) + 1; j < service.resources.length; j ++) {
                    if(service.resources[l].name == service.resources[m].name) return {error: {message: '(BBT.Connector.addDevice) Parameter error: a device\'s service must not have resources with the same name!', code: 11}};
                }
            }
        }
    }
    return null;
}

BBT.Connector.prototype.addDevice = function(params, callback) {
    var err = this.validateData(params, addDeviceSchema, validateDeviceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify({device: params});
    this.postData('/api/devices/add', bodystr, callback);
}

var deleteDeviceSchema = {
    device: joi.string().min(2).max(30).required()
}

BBT.Connector.prototype.deleteDevice = function(params, callback) {
    var err = this.validateData(params, deleteDeviceSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);
    this.postData('/api/devices/delete', bodystr, callback);
}

var eventSchema = {
    device: joi.string().min(2).max(30).required(),
    service: joi.string().max(30).required(),
    resource: joi.string().max(30).required(),
    data: joi.any().required(),
    source: joi.string().max(30).optional()
}

BBT.Connector.prototype.sendEvent = function(params, callback) {
    var err = this.validateData(params, eventSchema);
    if(err) return callback({error: {message: err.message, code: 11}});

    var bodystr = JSON.stringify(params);

    this.postData('/api/event/write', bodystr, callback);
}

BBT.Connector.prototype.sign = function(str) {
    return this.signer.getSignature(str);
}

module.exports = BBT;

