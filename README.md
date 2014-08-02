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

A simple example of writing/reading data to/from a resource.

Remember, Beebotte resource description uses a two levels hierarchy:
  - Channel: physical or virtual connected object (an application, an arduino, a coffee machine, etc) providing some resources
  - Resource: most elementary part of Beebotte, this is the actual data source (temperature from a domotics sensor)

an example can be a smart home device including multiple sensors (humidity, temperature: i.e. services) offering a number of resources (humidity rate , temperature, high temperature alert, etc.)

```javascript
  //Include the Beebotte SDK for nodejs
  var bbt = require('beebotte');

  //Create a Beebotte connector
  //Replace access key and security key by those of your account
  var bclient = new bbt.Connector({keyId: 'ACCESS KEY', secretKey: 'SECURITY KEY'});

  bclient.write(
    {channel: 'mychannel', resource: 'resource1', data: 'Hello World'},
    function(err, res) {
      if(err) throw(err);
      console.log(res);
  });

  bclient.read({
    channel: 'mychannel',
    resource: 'resource1', 
    limit: 5/* Retrieves last 5 records */
  }, function(err, res) {
    if(err) throw(err);
    console.log(res);
  });
```

## License
Copyright 2013 - 2014 Beebotte.

[The MIT License](http://opensource.org/licenses/MIT)
