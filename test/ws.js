var async = require('async')
var chai = require('chai')
var assert = chai.assert
var expect = chai.expect
var bbt = require('../index')

var ctoken = ''
var oktoken = ''
var kotoken = ''
var hostname = 'api.beebotte.com'
var wshostname = 'ws.beebotte.com'
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

function createWsConnection (ssl) {
  return new bbt.Stream({transport: {
    type: 'socketio',
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY,
    ws_host: wshostname, //default can be omitted
    ssl: ssl
  },
  userinfo: {
    username: 'someuser',
    userid: '1234567890'
  }});
}

function createWsConnectionToken (ssl, token) {
  return new bbt.Stream({transport: {
    type: 'socketio',
    ws_host: wshostname, //default can be omitted
    ssl: ssl,
    token: token
  },
  userinfo: {
    username: 'someuser',
    userid: '1234567890'
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
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
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
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        kotoken = doc.token
        done()
      }
    })
  })
})

describe('beebotte.ws Signaling tests. API Keys Auth', function () {

  this.timeout(15000)

  var wsclient
  var wsclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclientsig = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclientsig.on('connected', function() {
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
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('*')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 1000)

    wsclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('private-signaling')
      expect(sub.resource).to.be.equal('*')
      subscribed = true
    })

    wsclientsig.subscribe('private-signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('connect')
      done()
    }, 1000)

    wsclient = createWsConnection(useSSL)
  })

  it('should receive subscribe signaling message with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 1000)

    wsclient.on('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', onSub)
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        return done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('unsubscribe')
      done()
    }, 1000)

    wsclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
    })

    wsclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        expect(sigmsg.data.protocol).to.be.equal('socketio')
        expect(sigmsg.channel).to.be.equal('private-signaling')
        expect(sigmsg.resource).to.be.equal('disconnect')
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws Positive tests. API Keys Auth', function () {

  this.timeout(15000)

  var wsclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclient = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
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
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('*')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('private-signaling')
      expect(sub.resource).to.be.equal('*')
      subscribed = true
    })

    wsclient.subscribe('private-signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should subscribe to chan/* with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('chan')
      expect(sigmsg.data.resource).to.be.equal('*')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('chan')
      expect(sub.resource).to.be.equal('*')
      subscribed = true
    })

    wsclient.subscribe('chan', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg1')
      done()
    }, 500)

    wsclient.publish('test', 'test', 'msg1')
  })

  it('should receive published message to chan/res with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal(123)
      done()
    }, 500)

    wsclient.publish('chan', 'res', 123)
  })

  it('should receive written message with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg2')
      done()
    }, 500)

    wsclient.write('test', 'test', 'msg2')
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

    wsclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
    })

    wsclient.unsubscribe('test', 'test')
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

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws SoS latest message reception', function () {

  this.timeout(15000)

  var wsclient
  var msg = null

  function onSub (message) {
    msg = message.data
  }

  before(function() {
    wsclient = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/test with success and receive latest message', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(msg).to.be.equal('msg2')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, onSub)
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

    wsclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
    })

    wsclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws write to non existing channel', function () {

  this.timeout(15000)

  var wsclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclient = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to nonchannel/res1 with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('nonchannel')
      expect(sub.resource).to.be.equal('res1')
      subscribed = true
    })

    wsclient.subscribe('nonchannel', 'res1', {read: true, write: true}, onSub)
  })

  it('should fail when writing to non existing channel', function (done){

    setTimeout(function () {
      expect(msg).not.to.be.equal(-1)
      done()
    }, 1000)

    wsclient.write('nonchannel', 'res1', -1)
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws write to non existing resource', function () {

  this.timeout(15000)

  var wsclient
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclient = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/nonexistingres with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('nonexistingres')
      subscribed = true
    })

    wsclient.subscribe('test', 'nonexistingres', {read: true, write: true}, onSub)
  })

  it('should fail when writing to non existing resource', function (done){

    setTimeout(function () {
      expect(msg).not.to.be.equal(-1)
      done()
    }, 1000)

    wsclient.write('test', 'nonexistingres', '12345678901234567890')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws Positive tests. Token Auth', function () {

  this.timeout(15000)

  var wsclient
  var wsclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclient = createWsConnectionToken(useSSL, ctoken)
    wsclientsig = createWsConnection(useSSL)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false
    var connectedsig = false

    setTimeout(function () {
      if (!connected && !connectsig) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      } else {
        return done()
      }
    }, 5000)

    wsclient.on('connected', function() {
      connected = true
    })
    wsclientsig.on('connected', function() {
      connectedsig = true
    })
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('*')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('private-signaling')
      expect(sub.resource).to.be.equal('*')
      subscribed = true
    })

    wsclientsig.subscribe('private-signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg1')
      done()
    }, 500)

    wsclient.publish('test', 'test', 'msg1')
  })

  it('should receive written message with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg2')
      done()
    }, 500)

    wsclient.write('test', 'test', 'msg2')
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        return done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      }
    }, 5000)

    wsclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
      done()
    })

    wsclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })

  it('should disconnect from signaling connection with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclientsig.on('disconnected', function () {
      disconnected = true
    })

    wsclientsig.disconnect()
  })
})

describe('beebotte.ws Positive tests. IAM Token Auth', function () {

  this.timeout(15000)

  var wsclient
  var wsclientsig
  var msg = null
  var sigmsg = null

  function onSub (message) {
    msg = message.data
  }

  function onSig (message) {
    sigmsg = message
  }

  before(function() {
    wsclient = createWsConnectionToken(useSSL, ctoken)
    wsclientsig = createWsConnectionToken(useSSL, oktoken)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false
    var connectedsig = false

    setTimeout(function () {
      if (!connected && !connectsig) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      } else {
        return done()
      }
    }, 5000)

    wsclient.on('connected', function() {
      connected = true
    })
    wsclientsig.on('connected', function() {
      connectedsig = true
    })
  })

  it('should subscribe to signaling channel with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe to signaling channel'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('signaling')
      expect(sigmsg.data.resource).to.be.equal('*')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclientsig.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('private-signaling')
      expect(sub.resource).to.be.equal('*')
      subscribed = true
    })

    wsclientsig.subscribe('private-signaling', {read: true, write: false}, onSig)
  })

  it('should subscribe to test/test with success', function (done){

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      }
      expect(sigmsg.data.protocol).to.be.equal('socketio')
      expect(sigmsg.data.channel).to.be.equal('test')
      expect(sigmsg.data.resource).to.be.equal('test')
      expect(sigmsg.channel).to.be.equal('private-signaling')
      expect(sigmsg.resource).to.be.equal('subscribe')
      done()
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, onSub)
  })

  it('should receive published message to test/test with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg1')
      done()
    }, 500)

    wsclient.publish('test', 'test', 'msg1')
  })

  it('should receive written message with success', function (done){

    setTimeout(function () {
      expect(msg).to.be.equal('msg2')
      done()
    }, 500)

    wsclient.write('test', 'test', 'msg2')
  })

  it('should unsubscribe from channel with success', function (done){

    var unsubscribed = false

    setTimeout(function () {
      if (!unsubscribed) {
        return done(new Error('Failed to unsubscribe after 2 seconds from unsubscription request'))
      }
    }, 5000)

    wsclient.on('unsubscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      unsubscribed = true
      done()
    })

    wsclient.unsubscribe('test', 'test')
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })

  it('should disconnect from signaling connection with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclientsig.on('disconnected', function () {
      disconnected = true
    })

    wsclientsig.disconnect()
  })
})

describe('beebotte.ws. Token Auth. Subscribe to non authorized channel/resource', function () {

  this.timeout(15000)

  var wsclient

  before(function() {
    wsclient = createWsConnectionToken(useSSL, ctoken)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
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
    }, 2000)

    wsclient.once('subscribeError', function (sub) {
      subscribed = false
    })

    wsclient.subscribe('otherthantest', '*', {read: true, write: true}, function () {})
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws. IAM Token Auth. Subscribe with no read write IAM token', function () {

  this.timeout(15000)

  var wsclient

  before(function() {
    wsclient = createWsConnectionToken(useSSL, kotoken)
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should get authorization error when subscribing to any resource', function (done){

    var subscribed = null

    setTimeout(function () {
      if (subscribed === false) {
        return done()
      } else {
        return done(new Error('Should fail subscribing to a channel with no read write IAM token'))
      }
    }, 2000)

    wsclient.once('subscribeError', function (sub) {
      subscribed = false
    })

    wsclient.subscribe('otherthantest', '*', {read: true, write: true}, function () {})
  })

  it('should disconnect with success', function (done){

    var disconnected = false

    setTimeout(function () {
      if (!disconnected) {
        return done(new Error('Failed to receive disconnected event after 2 seconds from disconnection'))
      } else {
        done()
      }
    }, 2000)

    wsclient.on('disconnected', function () {
      disconnected = true
    })

    wsclient.disconnect()
  })
})

describe('beebotte.ws ws user connection management', function() {

  this.timeout(15000)

  var wsclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    wsclient = createWsConnection(useSSL)

    wsclient.on('disconnected', function() {
      disconnected = true
    })
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/test with success', function (done) {

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      } else {
        done()
      }
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, function () {})
  })

  it('should get user connections without error', function(done) {
    bclient.getUserConnections({protocol: 'socketio'}, function(err, res) {
      if (err) {
        return done(err)
      }
      console.log(wsclient.userinfo)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({
      userid: wsclient.userinfo.userid,
      protocol: 'socketio'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('socketio')
      expect(res[0].clientid).to.be.equal(wsclient.userinfo.userid)
      expect(res[0].userid).to.be.equal(wsclient.userinfo.userid)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({
      userid: wsclient.userinfo.userid,
      protocol: 'socketio',
      sid: wsclient.connection._id
    }, function (err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('socketio')
      expect(res[0].clientid).to.be.equal(wsclient.userinfo.userid)
      expect(res[0].userid).to.be.equal(wsclient.userinfo.userid)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({
      userid: wsclient.userinfo.userid,
      protocol: 'socketio'
    }, function (err, res) {
      if(err) {
        return done(err)
      }
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should have been disconnected following drop command'))
      } else {
        done()
      }
    }, 6000)

    bclient.dropUserConnection({
      userid: wsclient.userinfo.userid,
      sid: wsclient.connection._id,
      protocol: 'socketio'
    }, function (err, res) {
      if(err) {
        return done(err)
      } else {
        expect(res).to.be.equal('')
      }
    })
  })
})

describe('beebotte.ws all proto user connection management', function() {

  this.timeout(15000)

  var wsclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    wsclient = createWsConnection(useSSL)

    wsclient.on('disconnected', function() {
      disconnected = true
    })
  })

  it('should receive connected event upon connection', function (done){

    var connected = false

    setTimeout(function () {
      if (!connected) {
        return done(new Error('Failed to receive connected event after 5 seconds from connection'))
      }
    }, 12000)

    wsclient.on('connected', function() {
      connected = true
      done()
    })
  })

  it('should subscribe to test/test with success', function (done) {

    var subscribed = false

    setTimeout(function () {
      if (!subscribed) {
        return done(new Error('Failed to subscribe after 2 seconds from subscription request'))
      } else {
        done()
      }
    }, 2000)

    wsclient.once('subscribed', function (sub) {
      expect(sub.channel).to.be.equal('test')
      expect(sub.resource).to.be.equal('test')
      subscribed = true
    })

    wsclient.subscribe('test', 'test', {read: true, write: true}, function () {})
  })

  it('should get user connections without error', function(done) {
    bclient.getUserConnections(function(err, res) {
      if (err) {
        return done(err)
      }
      console.log(wsclient.userinfo)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({
      userid: wsclient.userinfo.userid
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('socketio')
      expect(res[0].clientid).to.be.equal(wsclient.userinfo.userid)
      expect(res[0].userid).to.be.equal(wsclient.userinfo.userid)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({
      userid: wsclient.userinfo.userid,
      sid: wsclient.connection._id
    }, function (err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      expect(res[0].protocol).to.be.equal('socketio')
      expect(res[0].clientid).to.be.equal(wsclient.userinfo.userid)
      expect(res[0].userid).to.be.equal(wsclient.userinfo.userid)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({
      userid: wsclient.userinfo.userid
    }, function (err, res) {
      if(err) {
        return done(err)
      }
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {

    setTimeout(function () {
      if (!disconnected) {
        done(new Error('Should have been disconnected following drop command'))
      } else {
        done()
      }
    }, 6000)

    bclient.dropUserConnection({
      userid: wsclient.userinfo.userid,
      sid: wsclient.connection._id
    }, function (err, res) {
      if(err) {
        return done(err)
      } else {
        expect(res).to.be.equal('')
      }
    })
  })
})

describe('beebotte.ws disconnect on token invalidation', function() {

  this.timeout(15000)

  var wsclient
  var bclient
  var disconnected = null

  before(function() {
    bclient = createConnection()
    wsclient = createWsConnectionToken(useSSL, ctoken)

    wsclient.on('disconnected', function() {
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

    wsclient.on('connected', function() {
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
    }, 5000)

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
