var async = require('async')
var chai = require('chai')
var assert = chai.assert
var expect = chai.expect
var bbt = require('../index')
var mqtt = require('mqtt')

var ctoken = ''
var oktoken = ''
var kotoken = ''

var hostname = 'api.beebotte.com'
var mqtthostname = 'mqtt.beebotte.com'
var useSSL = true

function createConnection() {
  return new bbt.Connector({
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY,
    hostname: hostname,
    //port: port,
    ssl: false
  });
}

function createMqttConnection (ssl) {
  return new bbt.Stream({transport: {
    type: 'mqtt',
    mqtt_host: mqtthostname,
    clientId: 'bbt_test-bbttest-' + Math.floor(Math.random() * 1000000000).toString(),
    ssl: ssl,
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY
  }});
}

function createMqttConnectionToken (ssl, token) {
  return new bbt.Stream({transport: {
    type: 'mqtt',
    mqtt_host: mqtthostname,
    ssl: ssl,
    token: token
  }});
}

describe('beebotte.rest - give me test tokens', function() {
  this.timeout(15000)
  var bclient = createConnection()

  var okiamtoken = {
    name: 'OKTOKEN',
    description: 'some description',
    acl: [{
      action: 'data:read'
    }, {
      action: 'data:write'
    }]
  }

  var koiamtoken = {
    name: 'KOTOKEN',
    description: 'some description',
    acl: [{
      action: 'data:read',
      resource: ['nothingreallythere', 'test.resourcenotexist']
    }, {
      action: 'data:write',
      resource: ['nothingreallythere', 'test.resourcenotexist']
    }, {
      action: 'admin:beerule:read',
    }]
  }

  it('should get existing channel without error', function(done) {
    bclient.getChannel('test', function (err, res) {
      if(err) return done(err)
      expect(res).to.have.property('name')
      expect(res).to.have.property('token')
      expect(res.name).to.be.equal('test')
      ctoken = res.token
      done()
    })
  })

  it('It should create read write IAM token without errors', function (done) {

    bclient.createIAMToken(okiamtoken, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be beebotte')
        assert.equal(doc.acl[0].action, 'data:read', 'Action type must be data:read')
        assert.equal(doc.acl[1].action, 'data:write', 'Action type must be data:write')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        oktoken = doc.token
        done()
      }
    })
  })

  it('It should create non read write IAM token without errors', function (done) {

    bclient.createIAMToken(koiamtoken, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be beebotte')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        kotoken = doc.token
        done()
      }
    })
  })
})

describe('beebotte.mqtt Signaling tests. API Keys Auth', function () {

  this.timeout(15000)

  var mqttclient
  var mqttclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclientsig = createMqttConnection(useSSL)
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('#')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 1000)

    mqttclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('signaling')
      expect(sub.resource).to.be.equal('#')
      subscribed = true
    })

    mqttclientsig.subscribe('signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('connect')
      done()
    }, 1000)

    mqttclient = createMqttConnection(useSSL)
  })

  it('should receive subscribe signaling message with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 1000)

    mqttclient.on('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    mqttclient.subscribe('test', 'test', onSub)
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('unsubscribe')
      done()
    }, 1000)

    mqttclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
    })

    mqttclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        expect(sigmsg.data.protocol).to.be.equal('mqtt')
        expect(sigmsg.channel).to.be.equal('signaling')
        expect(sigmsg.resource).to.be.equal('disconnect')
        done()
      }
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})

describe('beebotte.mqtt Positive tests. API Keys Auth', function () {

  this.timeout(15000)

  var mqttclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclient = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('#')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('signaling')
      expect(sub.resource).to.be.equal('#')
      subscribed = true
    })

    mqttclient.subscribe('signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    mqttclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should subscribe to chan/# with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('chan')
      expect(sigmsg.data.resource).to.be.equal('#')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('chan')
      expect(sub.resource).to.be.equal('#')
      subscribed = true
    })

    mqttclient.subscribe('chan', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg1')
      done()
    }, 500)

    mqttclient.publish('test', 'test', 'msg1')
  })

  it('should receive published message to chan/res with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal(123)
      done()
    }, 500)

    mqttclient.publish('chan', 'res', 123)
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
        return done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      } else {
        done()
      }
    }, 2000)

    mqttclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
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
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})

describe('beebotte.mqtt SoS latest message reception', function () {

  this.timeout(15000)

  var mqttclient
  var msg = null

  function onSub (message) {
    msg = message.data
  }

  before(function() {
    mqttclient = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/test with success and receive latest message', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(msg).to.be.equal('msg2')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    mqttclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        return done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      } else {
        done()
      }
    }, 2000)

    mqttclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
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
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})

describe('beebotte.mqtt write to non existing channel', function () {

  this.timeout(15000)

  var mqttclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclient = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to nonchannel/res1 with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('nonchannel')
      expect(sub.resource).to.be.equal('res1')
      subscribed = true
    })

    mqttclient.subscribe('nonchannel', 'res1', {read: true, write: true}, onSub)
  })

  it('should get disconnect when writing to non existing channel', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should disconnect on write failure'))
      } else {
        done()
      }
    }, 500)

    mqttclient.once('disconnected', function () {
      disconnected = true
      mqttclient.disconnect()
    })

    mqttclient.write('nonchannel', 'res1', -1)
  })
})

describe('beebotte.mqtt write to non existing resource', function () {

  this.timeout(15000)

  var mqttclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclient = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/nonexistingres with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('nonexistingres')
      subscribed = true
    })

    mqttclient.subscribe('test', 'nonexistingres', {read: true, write: true}, onSub)
  })

  it('should get disconnect when writing to non existing resource', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should disconnect on write failure'))
      } else {
        done()
      }
    }, 500)

    mqttclient.once('disconnected', function () {
      disconnected = true
      mqttclient.disconnect()
    })

    mqttclient.write('test', 'nonexistingres', '12345678901234567890')
  })
})

describe('beebotte.mqtt Positive tests. Channel Token Auth', function () {

  this.timeout(15000)

  var mqttclient
  var mqttclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclient = createMqttConnectionToken(useSSL, ctoken)
    mqttclientsig = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('#')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('signaling')
      expect(sub.resource).to.be.equal('#')
      subscribed = true
    })

    mqttclientsig.subscribe('signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    mqttclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

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
        done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
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
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })

  it('should disconnect from signaling connection with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    mqttclientsig.on('disconnected', function () {
      disconnected = true
    })

    mqttclientsig.disconnect()
  })
})

describe('beebotte.mqtt Positive tests. IAM Token Auth', function () {

  this.timeout(15000)

  var mqttclient
  var mqttclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    mqttclient = createMqttConnectionToken(useSSL, oktoken)
    mqttclientsig = createMqttConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('#')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('signaling')
      expect(sub.resource).to.be.equal('#')
      subscribed = true
    })

    mqttclientsig.subscribe('signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('mqtt')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    mqttclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    mqttclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

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
        done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
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
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })

  it('should disconnect from signaling connection with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    mqttclientsig.on('disconnected', function () {
      disconnected = true
    })

    mqttclientsig.disconnect()
  })
})

describe('beebotte.mqtt. Token Auth. Subscribe to non authorized channel/resource', function () {

  this.timeout(15000)

  var mqttclient

  before(function() {
    mqttclient = createMqttConnectionToken(useSSL, ctoken)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should get authorization error when subscribing to non authorized resource', function (done){

    var subscribed = null

    setTimeout(function () {
      if (subscribed === false) {
        return done()
      } else {
        return done(new Error('Should fail subscribing to a channel not corresponding to the Token'))
      }
    }, 500)

    mqttclient.once('subscribeError', function (sub) {
      subscribed = false
    })

    mqttclient.subscribe('otherthantest', '#', {read: true, write: true}, function () {})
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})

describe('beebotte.mqtt. IAM Token Auth. Subscribe to non authorized channel/resource', function () {

  this.timeout(15000)

  var mqttclient

  before(function() {
    mqttclient = createMqttConnectionToken(useSSL, kotoken)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should get authorization error when subscribing to non authorized resource', function (done){

    var subscribed = null

    setTimeout(function () {
      if (subscribed === false) {
        return done()
      } else {
        return done(new Error('Should fail subscribing to a channel not corresponding to the Token'))
      }
    }, 500)

    mqttclient.once('subscribeError', function (sub) {
      subscribed = false
    })

    mqttclient.subscribe('otherthantest', '#', {read: true, write: true}, function () {})
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    mqttclient.on('disconnected', function () {
      disconnected = true
    })

    mqttclient.disconnect()
  })
})

describe('beebotte.mqtt. Use regular MQTT - Channel Token authentication', function () {

  this.timeout(15000)

  var mqttclientsub
  var mqttclientpub
  var msg = null

  var onMsg = function (topic, message) {
    msg = message.toString()
  }

  before(function() {

    mqttclientsub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: 'token:' + ctoken,
        password: ''
      }
    )

    mqttclientpub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: 'token:' + ctoken,
        password: ''
      }
    )
  })

  it('should connect and subscribe with success', function (done) {

    var subconnected
    var pubconnected
    var subsubscribed

    setTimeout(function () {
      if (subconnected && subsubscribed && pubconnected) {
        return done()
      } else {
        return done(new Error('Something went wrong with pub sub connections'))
      }
    }, 6000)

    mqttclientsub.on('connect', function () {
      subconnected = true
      mqttclientsub.subscribe('test/test', function (err, granted) {
        if (granted.length === 1 && granted[0].qos !== 0x80) {
          subsubscribed = true
        }
      })
      mqttclientsub.on('message', onMsg)
    })
    mqttclientpub.on('connect', function () {
      pubconnected = true
    })
  })

  it('should receive published text message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('Hello World')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', 'Hello World')
  })

  it('should receive non JSON published message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('{pppp}pppp')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', '{pppp}pppp')
  })

  it('should disconnect with success', function (done){

    mqttclientpub.end()
    mqttclientsub.end()
    done()
  })
})

describe('beebotte.mqtt. Use regular MQTT - Channel Token authentication no prefix', function () {

  this.timeout(15000)

  var mqttclientsub
  var mqttclientpub
  var msg = null

  var onMsg = function (topic, message) {
    msg = message.toString()
  }

  before(function() {

    mqttclientsub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: ctoken,
        password: ''
      }
    )

    mqttclientpub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: ctoken,
        password: ''
      }
    )
  })

  it('should connect and subscribe with success', function (done) {

    var subconnected
    var pubconnected
    var subsubscribed

    setTimeout(function () {
      if (subconnected && subsubscribed && pubconnected) {
        return done()
      } else {
        return done(new Error('Something went wrong with pub sub connections'))
      }
    }, 6000)

    mqttclientsub.on('connect', function () {
      subconnected = true
      mqttclientsub.subscribe('test/test', function (err, granted) {
        if (granted.length === 1 && granted[0].qos !== 0x80) {
          subsubscribed = true
        }
      })
      mqttclientsub.on('message', onMsg)
    })
    mqttclientpub.on('connect', function () {
      pubconnected = true
    })
  })

  it('should receive published text message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('Hello World')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', 'Hello World')
  })

  it('should receive non JSON published message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('{pppp}pppp')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', '{pppp}pppp')
  })

  it('should disconnect with success', function (done){

    mqttclientpub.end()
    mqttclientsub.end()
    done()
  })
})

describe('beebotte.mqtt. Use regular MQTT - IAM Token authentication', function () {

  this.timeout(15000)

  var mqttclientsub
  var mqttclientpub
  var msg = null

  var onMsg = function (topic, message) {
    msg = message.toString()
  }

  before(function() {

    mqttclientsub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: oktoken,
        password: ''
      }
    )

    mqttclientpub =  mqtt.connect(
      'mqtt://' + mqtthostname,
      //Authenticate with your channel token,
      {
        username: oktoken,
        password: ''
      }
    )
  })

  it('should connect and subscribe with success', function (done) {

    var subconnected
    var pubconnected
    var subsubscribed

    setTimeout(function () {
      if (subconnected && subsubscribed && pubconnected) {
        return done()
      } else {
        return done(new Error('Something went wrong with pub sub connections'))
      }
    }, 6000)

    mqttclientsub.on('connect', function () {
      subconnected = true
      mqttclientsub.subscribe('test/test', function (err, granted) {
        if (granted.length === 1 && granted[0].qos !== 0x80) {
          subsubscribed = true
        }
      })
      mqttclientsub.on('message', onMsg)
    })
    mqttclientpub.on('connect', function () {
      pubconnected = true
    })
  })

  it('should receive published text message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('Hello World')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', 'Hello World')
  })

  it('should receive non JSON published message without errors', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('{pppp}pppp')
      done()
    }, 1000)

    mqttclientpub.publish('test/test', '{pppp}pppp')
  })

  it('should disconnect with success', function (done){

    mqttclientpub.end()
    mqttclientsub.end()
    done()
  })
})

describe('beebotte.mqtt mqtt user connection management', function() {

  this.timeout(15000)

  var mqttclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    mqttclient = createMqttConnection(useSSL)

    mqttclient.on('disconnected', function() {
      disconnected = true
      mqttclient.disconnect()
    })
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should get user connections without error', function(done) {
    bclient.getUserConnections({
      protocol: 'mqtt'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({
      userid: mqttclient.transport.clientId,
      protocol: 'mqtt'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('mqtt')
      expect(res[0].clientid).to.be.equal(mqttclient.transport.clientId)
      expect(res[0].userid).to.be.equal(mqttclient.transport.clientId)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({
      userid: mqttclient.transport.clientId,
      protocol: 'mqtt',
      sid: mqttclient.transport.clientId
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('mqtt')
      expect(res[0].clientid).to.be.equal(mqttclient.transport.clientId)
      expect(res[0].userid).to.be.equal(mqttclient.transport.clientId)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({
      userid: mqttclient.transport.clientId,
      protocol: 'mqtt'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should not have been disconnected following drop command with sid'))
      } else {
        done()
      }
    }, 1000)

    bclient.dropUserConnection({
      userid: mqttclient.transport.clientId,
      sid: mqttclient.transport.clientId,
      protocol: 'mqtt'
    }, function(err, res) {
      if(err) {
        return done(err)
      } else {
        expect(res).to.be.equal('')
      }
    })
  })
})

describe('beebotte.mqtt All protocols user connection management', function() {

  this.timeout(15000)

  var mqttclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    mqttclient = createMqttConnection(useSSL)

    mqttclient.on('disconnected', function() {
      disconnected = true
      mqttclient.disconnect()
    })
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should get user connections without error', function(done) {
    bclient.getUserConnections(function (err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({
      userid: mqttclient.transport.clientId
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('mqtt')
      expect(res[0].clientid).to.be.equal(mqttclient.transport.clientId)
      expect(res[0].userid).to.be.equal(mqttclient.transport.clientId)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({
      userid: mqttclient.transport.clientId,
      sid: mqttclient.transport.clientId
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('mqtt')
      expect(res[0].clientid).to.be.equal(mqttclient.transport.clientId)
      expect(res[0].userid).to.be.equal(mqttclient.transport.clientId)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({
      userid: mqttclient.transport.clientId
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should not have been disconnected following drop command with sid'))
      } else {
        done()
      }
    }, 1000)

    bclient.dropUserConnection({
      userid: mqttclient.transport.clientId,
      sid: mqttclient.transport.clientId
    }, function(err, res) {
      if(err) {
        return done(err)
      } else {
        expect(res).to.be.equal('')
      }
    })
  })
})

describe('beebotte.mqtt disconnect on token invalidation', function() {

  this.timeout(15000)

  var mqttclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    mqttclient = createMqttConnectionToken(useSSL, ctoken)

    mqttclient.on('disconnected', function() {
      disconnected = true
    })
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    mqttclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should regenerate channel token without error', function(done) {

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should have been disconnected following token regeneration'))
      } else {
        done()
      }
    }, 1000)

    bclient.regenerateChannelToken('test', function(err, res) {
      if(err) {
        return done(err)
      }
    })
  })

  after(function () {
    bclient.getIAMTokens((err, docs) => {
      if (err) {
        return
      } else {
        async.each(docs, (doc, callback) => {
          bclient.deleteIAMToken(doc._id, callback)
        }, err => {
          if (err) {
            return
          } else {
          }
        })
      }
    })
  })
})
