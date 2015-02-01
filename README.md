Beebotte Node.JS SDK
====================

| what          | where                                  |
|---------------|----------------------------------------|
| overview      | http://beebotte.com/overview           |
| tutorials     | http://beebotte.com/tutorials          |
| apidoc        | http://beebotte.com/docs/restapi       |
| source        | https://github.com/beebotte/bbt_node   |

### Bugs / Feature Requests

Think you.ve found a bug? Want to see a new feature in beebotte? Please open an
issue in github. Please provide as much information as possible about the issue type and how to reproduce it.

  https://github.com/beebotte/bbt_node/issues

## Install

To install the most recent release from npm, run:

    npm install beebotte

## Introduction

This Node.js library provides: 
* REST client, and,
* Stream pub/sub client to Beebotte API

The Stream API supports two transports:
* MQTT
* Socket.io

Remember, Beebotte resource description uses a two levels hierarchy:
  - Channel: physical or virtual connected object (an application, an arduino, a coffee machine, etc) providing some resources
  - Resource: most elementary part of Beebotte, this is the actual data source (temperature from a domotics sensor)

## Usage

### REST Connector

```javascript
  //Include the Beebotte SDK for nodejs
  var bbt = require('beebotte');

  //Create a Beebotte connector
  //Replace access key and secret key by those of your account
  var client = new bbt.Connector({keyId: 'ACCESS KEY', secretKey: 'SECRET KEY'});

  //write (persistent message) to a given channel & resource
  client.write(
    {channel: 'mychannel', resource: 'resource1', data: 'Hello World'},
    function(err, res) {
      if(err) throw(err);
      console.log(res);
  });

  //publishe (transient message) to a given channel & resource
  client.write(
    {channel: 'mychannel', resource: 'resource1', data: 'Hello World'},
    function(err, res) {
      if(err) throw(err);
      console.log(res);
  });

  //read persistent messages from a given channel & resource
  client.read({
    channel: 'mychannel',
    resource: 'resource1', 
    limit: 5/* Retrieves last 5 records */
  }, function(err, res) {
    if(err) throw(err);
    console.log(res);
  });
```

### Stream Connector - MQTT transport

```javascript
  //Include the Beebotte SDK for nodejs
  var bbt = require('beebotte');

  //Replace access and secret keys by those of your account
  var transport = {
    type: 'mqtt',
    apiKey: 'ACCESS KEY', 
    secretKey: 'SECRET KEY',
  }
  
  //Create a Stream connector
  client = new bbt.Stream({ transport: transport });

  //On successful connection
  client.on('connected', function() {
    //subscribe to a channel/resource 
    client.subscribe( 'mychannel', 'myresource', function(message){
      console.log(message);
    })
    //On successful subscription
    .on('subscribed', function(sub) {
      client.publish( 'mychannel', 'myresource', 'Hello World');
    });
  });
```

### Stream Connector - Socket.io transport

```javascript
  //Include the Beebotte SDK for nodejs
  var bbt = require('beebotte');

  //Replace access and secret keys by those of your account
  var transport = {
    type: 'socketio',
    apiKey: 'ACCESS KEY',
    secretKey: 'SECRET KEY'
  }

  // Alternatively, you could specify an authentication endpoint (see beebotte.com/docs/clientauth)
  //Replace access key by that of your account
  var transport = {
    type: 'socketio',
    apiKey: 'ACCESS KEY', 
    auth_endpoint: 'YOUR AUTH ENDPOINT', //See https://beebotte.com/docs/clientauth 
  }
  
  //Create a Stream connector
  client = new bbt.Stream({ transport: transport });

  //On successful connection
  client.on('connected', function() {
    //subscribe to a channel/resource (with read and write access)
    client.subscribe( 'mychannel', 'myresource', {read: true, write: true}, function(message){
      console.log(message);
    })
    //On successful subscription
    .on('subscribed', function(sub) {
      client.publish( 'mychannel', 'myresource', 'Hello World');
    });
  });
```

## License
Copyright 2013 - 2014 Beebotte.

[The MIT License](http://opensource.org/licenses/MIT)
