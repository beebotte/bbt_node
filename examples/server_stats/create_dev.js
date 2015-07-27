/*
 * Example creating a channel to report system metrics like CPU and memory usage.
 * After creating your channel, you can run 'perf.js' script to start reporting to Beebotte.
 *
 * Copyright, Beebotte.com
 * MIT license
 */

var bbt = require('../../lib/bbt-node');

var bclient = new bbt.Connector(
  {
    //API and secret keys for your account
    apiKey: process.env.API_KEY,
    secretKey: process.env.SECRET_KEY,
    hostname: 'api.beebotte.com', //This is the default host anyway
    port: 80 //This is the default port number anyway
});

var channel = {
  name: 'my_device', 
  description: 'Device representing the OS stats of my embedded system', 
  ispublic: false, 
  resources: [
    {name: 'cpu', description: 'CPU usage', vtype: 'cpu'},
    {name: 'memory', description: 'Memory usage', vtype: 'memory'},
  ]
};

bclient.addChannel(channel, function(err, res) {
    if(err) return console.log(err);
    //The channel was created successfully!
    console.log(res);//expecting true as success result
});


