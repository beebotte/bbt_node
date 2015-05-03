var bbt = require('../../index');

var transport = {
  type: 'mqtt',
  apiKey: 'YOUR_API_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  mqtt_host: 'mqtt.beebotte.com', //default can be omitted
  ssl: true
}

var client = new bbt.Stream({ transport: transport });
var count = 0
var sender;

function startSender(c, to) {
  return setInterval(function() {
    c.publish( 'mychannel', 'latency', {ts: Date.now()});
  }, to);
}

function stopSender(s) {
  clearInterval(s);
}

client.on('connected', function() {
  client.subscribe( 'mychannel', 'latency', {read: true, write: true}, function(message){
    rtime = Date.now();
    stime = message.data.ts;
    console.log('Latency in millis: ' + ( rtime - stime ) );
    count++
    //disconnect after 20 messages
    if( count === 20) client.disconnect()
  });
}).on('disconnected', function() {
  stopSender(sender);
}).on('subscribeError', function( err ) {
  console.log( err );
}).on('subscribed', function(subscription) {
  //Publishes a message every 1 second
  sender = startSender(client, 1000);
}).on('unsubscribed', function() {
  stopSender(sender);
});
