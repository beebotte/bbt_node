var chai = require('chai'),
    assert = chai.assert,
    expect = chai.expect,
    bbt = require('../index');

var token = ''

function createConnection() {
  return new bbt.Connector({
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY
  });
}

function createMqttConnection(ssl) {
  return new bbt.Stream({transport: {
    type: 'mqtt',
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY
  }});
}

describe('beebotte.mqtt', function() {

  this.timeout(10000)

  var mqttclient
  var msg = null

  function onSub (message) {
    msg = message.data
  }

  before(function() {
    mqttclient = createMqttConnection(true)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done('Failed to receive connected event after 5 seconds from connection')
      }
    }, 15000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done('Failed to subscribe after 2 seconds from subscription request')
      }
    }, 5000)

    mqttclient.on('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
      done()
    })

    mqttclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should receive published message with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg1')
      done()
    }, 500)

    mqttclient.publish('test', 'test', 'msg1')
  })

  it('should receive written message with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg2')
      done()
    }, 500)

    mqttclient.write('test', 'test', 'msg2')
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        done('Failed to unsubscribe after 2 seconds from unsubscription request')
      }
    }, 5000)

    mqttclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
      done()
    })

    mqttclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 5000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})
