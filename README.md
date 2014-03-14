Beebotte Node.JS SDK
====================

| what          | where                                  |
|---------------|----------------------------------------|
| overview      | http://beebotte.com/overview           |
| tutorials     | http://beebotte.com/tutorials          |
| apidoc        | http://beebotte.com/api                |
| source        | https://github.com/beebotte/bbt_node   |

### Bugs / Feature Requests

Think you.ve found a bug? Want to see a new feature in beebotte? Please open an
issue in github. Please provide as much information as possible about the issue type and how to reproduce it.

  https://github.com/beebotte/bbt_node/issues

## Install

To install the most recent release from npm, run:

    npm install mongodb

## Introduction

A simple example of writing/reading data to/from a resource.

Remember, Beebotte resource description uses a three levels hierarchy:
  - Device: physical or virtual connected object (an application, an arduino, a coffee machine, etc) providing some services
  - Service: belongs to a device and offers specific service like sensing data
  - Resource: most elementary part of Beebotte, this is the actual data source (temperature from a domotics sensor)

Smart home device includes multiple sensors (services) offering a number of resources (humidity, temperature, high temperature alert, etc.)

```javascript
  //Include the Beebotte SDK for nodejs
  var bbt = require('beebotte');

  //Create a Beebotte connector
  var bclient = new bbt.Connector({keyId: 'ACCESS KEY', secretKey: 'SECURITY KEY'});

  bclient.writeResource(
    {device: 'test_dev', service: 'humid_sensor', resource: 'humidity', value: 80},
    function(err, res) {
      if(err) throw(err);
      console.log(res);
  });

  bclient.readResource({
    device: 'test_dev',
    service: 'temp_sensor', 
    resource: 'temperature', 
    limit: 5/* Retrieves last 5 records . default is 1 */
  }, function(err, res) {
    if(err) throw(err);
    console.log(res);
   });
```javascript

## License
Copyright 2013 - 2014 Beebotte.

[The MIT License](http://opensource.org/licenses/MIT)
