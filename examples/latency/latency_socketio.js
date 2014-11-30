var bbt = require('../../index');

var transport = {
  type: 'socketio',
  apiKey: 'YOUR_API_ACCESS_KEY', 
  ws_host: 'ws.beebotte.com', //default 
  auth_endpoint: 'YOUR_AUTH_ENDPOINT', 
  ssl: true
}

client = new bbt.Stream({ transport: transport });

client.on('connected', function(c) {
  client.subscribe( {channel: 'mychannel', resource: 'latency', read: true, write: true}, function(message){
    rtime = Date.now();
    stime = message.data.ts;
    console.log('Latency in millis: ' + ( rtime - stime ) );
  });

  client.on('subscribed', function(subscription) {
    //Publish a message every 1 second
    setInterval(function() {
      client.publish({channel: 'mychannel', resource: 'latency'}, {ts: Date.now()});
    }, 1000);
  });
});