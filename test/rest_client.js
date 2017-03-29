var chai = require('chai'),
    assert = chai.assert,
    expect = chai.expect,
    bbt = require('../index')

var token = ''
  , hostname = 'api.beebotte.com'

function createConnection() {
  return new bbt.Connector({
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY
    hostname: hostname,
    port: 80
  })
}

function createConnectionToken() {
  return new bbt.Connector({
    token: token,
    hostname: hostname,
    port: 80
  })
}

describe('beebotte.rest', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should create a channel without error', function(done) {
    bclient.addChannel({
      name: 'channeltest',
      label: 'test',
      description: 'channel test description',
      ispublic: true,
      resources: [
        {name: 'res1', label:'res1', vtype: 'number'},
        {name: 'res2', description: 'res2',  vtype: 'string'},
        {name: 'res3', vtype: 'any'}
      ]
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      bclient.getChannel('channeltest', function(err, res) {
        if(err) return done(err)
        token = res.token
        expect(res).to.have.property('name')
        expect(res.name).to.be.equal('channeltest')
        expect(res.resources[0].vtype).to.be.equal('number')
        done()
      })
    })
  })

  it('should get existing channel without error', function(done) {
    bclient.getChannel('channeltest', function(err, res) {
      if(err) return done(err)
      expect(res).to.have.property('name')
      expect(res.name).to.be.equal('channeltest')
      done()
    })
  })

  it('should add a resource without error', function(done) {
    bclient.addResource({
      channel: 'channeltest',
      resource: {
        name: 'resourcetest',
        label:'test resource',
        description: 'some description goes here',
        vtype: 'string'
      }
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should get all existing resources without error - resource parameter set to empty string', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: ''
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get all existing resources without error - resource parameter set to wildcard character \'*\'', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: '*'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get all existing resources without error - resource parameter set to null', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: '*'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get all existing resources without error - resource parameter not provided', function(done) {
    bclient.getResource({
      channel: 'channeltest'
    }, function(err, res) {
      if(err) done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get existing resource without error', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'resourcetest'
    }, function(err, res) {
      if(err) done(err)
      expect(res).to.have.property('channel')
      expect(res.channel).to.be.equal('channeltest')
      expect(res).to.have.property('name')
      expect(res.name).to.be.equal('resourcetest')
      expect(res).to.have.property('vtype')
      expect(res.vtype).to.be.equal('string')
      done()
    })
  })

  it('should fail due to resource not found', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'notexist'
    }, function(err, res) {
      if(err) return done()
      done('Get non existing resource succeeded')
    })
  })

  it('should fail due to format error', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'abc*'
    }, function(err, res) {
      if(err) return done()
      done('Get a resource with malformed name succeeded')
    })
  })

  it('should fail due to format error', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: '*abc'
    }, function(err, res) {
      if(err) return done()
      done('Get a resource with malformed name succeeded')
    })
  })

  it('should fail due to format error', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'a*c'
    }, function(err, res) {
      if(err) return done()
      done('Get a resource with malformed name succeeded')
    })
  })

  it('should fail due to format error (resource name too short)', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'a'
    }, function(err, res) {
      if(err) return done()
      done('Get a resource with too short resource name succeeded')
    })
  })

  it('should delete an existing resource without error', function(done) {
    bclient.deleteResource({
      channel: 'channeltest',
      resource: 'resourcetest'
    }, function (err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      bclient.getResource({
        channel: 'channeltest',
        resource: 'resourcetest'
      }, function (err, res) {
        if(err) return done()
        done('Got resource that was supposed to be deleted')
      })
    })
  })

  it('should fail due to resource not found', function(done) {
    bclient.getResource({
      channel: 'channeltest',
      resource: 'resourcetest'
    }, function (err, res) {
      if(err) return done()
      done('Get resource succeeded')
    })
  })
})

describe('beebotte.rest read/write operations', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should write to BBT without error', function(done) {
    bclient.write({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should write to BBT 2 records without error', function(done) {
    bclient.writeBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return node(err)
      expect(res).to.have.length(2)
      done()
    })
  })

  it('should read from BBT without error', function(done) {
    bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.have.length(1)
      expect(res[0]).to.have.property('data')
      expect(res[0].data).to.be.equal(1)
      done()
    })
  })

  it('should delete a record without error', function(done) {
    //old value was 1, add a new value, delete it then verify you get 1 again
    bclient.write({channel: 'channeltest', resource: 'res1', data: 111}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
        if(err) return done(err)
        expect(res).to.have.length(1)
        expect(res[0]).to.have.property('data')
        expect(res[0].data).to.be.equal(111)
        var _id = res[0]._id
        bclient.delete({channel: 'channeltest', resource: 'res1', _id: _id}, function(err, res) {
          if(err) return done(err)
          expect(res).to.have.property('data')
          expect(res.data).to.be.equal(111)
          bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
            if(err) return done(err)
            expect(res).to.have.length(1)
            expect(res[0]).to.have.property('data')
            expect(res[0].data).to.be.equal(1)
            done()
          })
        })
      })
    })
  })

  it('should fail deleting due to record not found', function(done) {
    bclient.delete({channel: 'channeltest', resource: 'res1', _id: '123443213'}, function(err, res) {
      if(err) return done()
      done('Delete succeeded')
    })
  })

  it('should update a record without error', function(done) {
    bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done(err)
      var _id = res[0]._id
      bclient.update({channel: 'channeltest', resource: 'res1', _id: _id, data: 5}, function(err, res) {
        if(err) return done(err)
        expect(res).to.be.equal(true)
        bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
          if(err) return done(err)
          expect(res).to.have.length(1)
          expect(res[0]).to.have.property('data')
          expect(res[0].data).to.be.equal(5)
          done()
        })
      })
    })
  })

  it('should fail due to resource not found', function(done) {
    bclient.write({channel: 'channeltest', resource: 'notexist', data: 1}, function(err, res) {
      if(err) return done()
      done('Write succeeded')
    })
  })

  it('should publish to BBT 2 records without error', function(done) {
    bclient.publishBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should publish to BBT without error', function(done) {
    bclient.publish({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })
})

describe('beebotte.rest read/write operations Token Auth', function() {
  this.timeout(15000)
  var bclient
  before(function() {
    bclient = createConnectionToken()
  })

  it('should write to BBT without error', function(done) {
    bclient.write({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should write to BBT 2 records without error', function(done) {
    bclient.writeBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.have.length(2)
      done()
    })
  })

  it('should read from BBT without error', function(done) {
    bclient.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.have.length(1)
      expect(res[0]).to.have.property('data')
      expect(res[0].data).to.be.equal(1)
      done()
    })
  })

  it('should fail due to resource not found', function(done) {
    bclient.write({channel: 'channeltest', resource: 'notexist', data: 1}, function(err, res) {
      if(err) return done()
      done('Write succeeded')
    })
  })

  it('should publish to BBT 2 records without error', function(done) {
    bclient.publishBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should publish to BBT without error', function(done) {
    bclient.publish({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })
})

describe('beebotte.rest channel delete', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should delete an existing channel without error', function(done) {
    bclient.deleteChannel('channeltest', function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      bclient.getChannel('channeltest', function(err, res) {
        if(err) return done()
        done('Got channel that was supposed to be deleted')
      })
    })
  })

  it('should fail due to channel not found', function(done) {
    bclient.getChannel('channeltest', function(err, res) {
      if(err) return done()
      done('Get channel succeeded')
    })
  })

  it('should get existing channels without error - channel parameter set to empty string', function(done) {
    bclient.getChannel('', function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get existing channels without error - channel parameter set to wildcard character \'*\'', function(done) {
    bclient.getChannel('', function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get existing channels without error - channel parameter set to null', function(done) {
    bclient.getChannel(null, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get existing channels without error - channel parameter not provided', function(done) {
    bclient.getChannel(function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('get channel should fail due to format error', function(done) {
    bclient.getChannel('a*c', function(err, res) {
      if(err) return done()
      done('Get a channel with malformed name succeeded')
    })
  })

  it('get channel should fail due to format error', function(done) {
    bclient.getChannel('abc*', function(err, res) {
      if(err) return done()
      done('Get a channel with malformed name succeeded')
    })
  })

  it('get channel should fail due to format error', function(done) {
    bclient.getChannel('*abc', function(err, res) {
      if(err) return done()
      done('Get a channel with malformed name succeeded')
    })
  })

  it('get channel should fail due to channel name too short', function(done) {
    bclient.getChannel('a', function(err, res) {
      if(err) return done()
      done('Get a channel with too short channel name succeeded')
    })
  })

})

describe('beebotte.connector websocket user connection management', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections(function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      console.log(res)
      //expect(res[0]).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({userid: '1234567890'}, function(err, res) {
      if(err) return done(err)
      console.log(res)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({userid: '1234567890', sid: 'abcdefg123456'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({userid: '1234567890'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {
    bclient.dropUserConnection({userid: '1234567890', sid: 'abcdefg123456'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })
})

describe('beebotte.connector mqtt user connection management', function() {

  this.timeout(15000)
  var bclient = createConnection()

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({protocol: 'mqtt'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      console.log(res)
      //expect(res[0]).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({
      userid: '1234567890',
      protocol: 'mqtt',
      sid: 'abcdefg123456'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({
      userid: '1234567890',
      protocol: 'mqtt'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {
    bclient.dropUserConnection({
      userid: '1234567890',
      protocol: 'mqtt',
      sid: 'abcdefg123456'
    }, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })
})
