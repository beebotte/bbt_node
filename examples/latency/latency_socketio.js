var bbt = require('../../index');

var transport = {
  type: 'socketio',
  apiKey: 'YOUR_API_ACCESS_KEY', 
  secretKey: 'YOUR_API_SECRET_KEY', 
  ws_host: 'ws.beebotte.com', 
  ssl: true 
}

client = new bbt.Stream({ transport: transport });

client.on('connected', function() {
  client.on('subscribeError', function( err ) {
    console.log( err );
  });
  client.on('subscribed', function(subscription) {
    //Publish a message every 1 second
    setInterval(function() {
      client.publish( 'mychannel', 'latency', {ts: Date.now()});
    }, 1000);
  });
  client.subscribe( 'mychannel', 'latency', {read: true, write: true}, function(message){
    rtime = Date.now();
    stime = message.data.ts;
    console.log('Latency in millis: ' + ( rtime - stime ) );
  });
});
