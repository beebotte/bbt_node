var async = require('async')
var chai = require('chai')
var assert = chai.assert
var expect = chai.expect
var bbt = require('../index')

var token = ''
var iamtokenread = ''
var iamtokenwrite = ''
var hostname = 'api.beebotte.com'
var beeruleid = null

function createConnection() {
  return new bbt.Connector({
    apiKey: process.env.APIKEY,
    secretKey: process.env.SECRETKEY,
    //port: port,
    hostname: hostname
  })
}

function createConnectionToken() {
  return new bbt.Connector({
    token: token,
    //port: port,
    hostname: hostname
  })
}

function createConnectionIAMToken(tkn) {
  return new bbt.Connector({
    token: tkn,
    //port: port,
    hostname: hostname
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
    }, function (err, res) {
      if (err) {
        return done(err)
      }
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

describe('Beebotte IAM Token Schema', function() {

  this.timeout(15000)
  var bclient = createConnection()

  var tokenid
  var tokenval

  var testtoken1 = {
    name: 'my token',
    description: 'some description',
    acl: [{
      action: 'data:read',
    }]
  }

  var testtoken2 = {
    name: 'my token',
    description: 'some description',
    acl: [{
      action: 'data:read',
    }, {
      action: 'data:write',
    }, {
      action: 'admin:beerule:read',
    }]
  }

  var testtoken3 = {
    name: 'my token',
    description: 'some description',
    acl: [{
      action: 'data:read',
      resource: ['channeltest.*']
    }]
  }

  var testtoken4 = {
    name: 'my token',
    description: 'some description',
    acl: [{
      action: 'data:write',
      resource: ['channeltest.res1']
    }]
  }

  var acl1 = [{
    action: 'data:write',
  }, {
    action: 'admin:beerule:read',
  }]

  it('It should create an access token with 1 acl rule without errors', function (done) {

    bclient.createIAMToken(testtoken1, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
        assert.equal(doc.acl[0].action, 'data:read', 'Action type must be data:read')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        done()
      }
    })
  })

  it('It should create an access token with 3 acl rules without errors', function (done) {

    bclient.createIAMToken(testtoken2, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
        assert.equal(doc.acl[0].action, 'data:read', 'Action type must be data:read')
        assert.equal(doc.acl.length, 3, 'ACL rules must be 3')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        tokenid = doc._id
        tokenval = doc.token
        done()
      }
    })
  })

  it('It should create an access token with dataread acl rules without errors', function (done) {

    bclient.createIAMToken(testtoken3, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
        assert.equal(doc.acl[0].action, 'data:read', 'Action type must be data:read')
        assert.equal(doc.acl[0].resource[0], testtoken3.acl[0].resource[0], 'ACL resource must be what was sent')
        assert.equal(doc.acl.length, 1, 'ACL rules must be 1')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        iamtokenread = doc.token
        done()
      }
    })
  })

  it('It should create an access token with datawrite acl rules without errors', function (done) {

    bclient.createIAMToken(testtoken4, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc.owner, 'bbt_test', 'owner must be bbt_test')
        assert.equal(doc.acl[0].action, 'data:write', 'Action type must be data:write')
        //assert.equal(doc.acl[0].resource[0], testtoken4.acl[0].resource[0], 'ACL resource must be what was sent')
        assert.equal(doc.acl.length, 1, 'ACL rules must be 1')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        iamtokenwrite = doc.token
        done()
      }
    })
  })

  it('It should get 4 iamtokens', function (done) {

    bclient.getIAMTokens((err, docs) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 4, 'Must get total of 4 iam tokens')
        done()
      }
    })
  })

  it('It should get iamtoken by token id with success', function (done) {

    bclient.getIAMTokenByID(tokenid, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc._id, tokenid, 'Must get matching token id')
        assert.equal(doc.owner, 'bbt_test', 'Must get matching iam token owner')
        assert.equal(doc.token, tokenval, 'Must get matching token value')
        done()
      }
    })
  })

  it('It should update iamtoken with success', function (done) {

    bclient.updateIAMToken(tokenid, acl1, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc._id, tokenid, 'Must get matching token id')
        assert.equal(doc.owner, 'bbt_test', 'Must get matching iam token owner')
        assert.equal(doc.token, tokenval, 'Must get matching token value')
        assert.equal(doc.acl[0].action, 'data:write', 'Action type must be data:write')
        assert.equal(doc.acl.length, 2, 'ACL rules should be 2')
        assert.equal(doc.token.startsWith('iamtkn'), true, 'Token value must start with iamtkn')
        done()
      }
    })
  })

  it('It should delete iamtoken with success', function (done) {

    bclient.deleteIAMToken(tokenid, (err, doc) => {
      if (err) {
        return done(err)
      } else {
        bclient.getIAMTokens((err, docs) => {
          if (err) {
            return done(err)
          } else {
            assert.equal(docs.length, 3, 'Must get total of 3 iam tokens')
            done()
          }
        })
      }
    })
  })
})

describe('beebotte.rest create and work with beerules', function() {
  this.timeout(15000)
  var bclient = createConnection()

  var testpub = {
    name: 'pub beerule',
    description: 'some description',
    trigger: {
      event: 'publish',
      channel: 'channeltest',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'publish',
      channel: 'channeltest1',
      resource: 'res1'
    }
  }

  var testpubwithval = {
    name: 'pub beerule',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: '*'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'publish',
      channel: 'channeltest1',
      resource: 'res1',
      value: 'channeltest.res1 + 30'
    }
  }

  var testwrite = {
    name: 'write beerule',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'write',
      channel: 'channeltest1',
      resource: 'res2'
    }
  }

  var testwritewithval = {
    name: 'write beerule',
    description: 'some description',
    trigger: {
      event: 'publish',
      channel: 'channeltest',
      resource: '*'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'write',
      channel: 'channeltest1',
      resource: 'res2',
      value: 'channeltest.res1 + 25'
    }
  }

  var testsms = {
    name: 'sms beerule',
    description: 'some description',
    trigger: {
      event: 'connect',
      channel: '*',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'sms',
      to: '+33625689452'
    }
  }

  var testemail = {
    name: 'email beerule',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'email',
      to: 'bwehbi@beebotte.com'
    }
  }

  var testwebhook = {
    name: 'webhook beerule',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'webhook',
      endpoint: 'https://demo0531850.mockable.io/'
    }
  }

  var testfcm = {
    name: 'fcm beerule',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: 'res1'
    },
    condition: 'channeltest.res1 > 0',
    action: {
      type: 'fcm',
      serverKey: 'somekey',
      senderID: 'someid',
      to: '/topics/sometopic',
      isTopic: true,
      isNotification: true
    }
  }

  var testwildcards = {
    name: 'email notif',
    description: 'some description',
    trigger: {
      event: 'write',
      channel: '*',
      resource: '*'
    },
    condition: 'channeltest.res1 > 10',
    action: {
      type: 'email',
      to: 'bwehbi@beebotte.com'
    }
  }

  var testwithowner = {
    name: 'email notif',
    description: 'some description',
    owner: 'bachwehbi',
    trigger: {
      event: 'write',
      channel: 'channeltest',
      resource: '*'
    },
    condition: 'channeltest.res1 > 10',
    action: {
      type: 'email',
      to: 'bwehbi@beebotte.com'
    }
  }

  it('should create a publish beerule without error', function(done) {
    bclient.createBeerule(testpub, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('publish')
      done()
    })
  })

  it('should create a publish beerule with value without error', function(done) {
    bclient.createBeerule(testpubwithval, function(err, res) {

      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res).to.have.nested.property('action.value')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('publish')
      beeruleid = res._id
      done()
    })
  })

  it('should invoke beerule without error', function(done) {
    bclient.invokeBeerule(beeruleid, {
      channel: 'channeltest',
      resource: 'someresource',
      data: 123
    }, function(err, res) {
      if (err) {
        return done(err)
      }

      return done()
    })
  })

  it('should fail invoking beerule with wrong channel name', function(done) {
    bclient.invokeBeerule(beeruleid, {
      channel: 'notexist',
      resource: 'someresource',
      data: 123
    }, function(err, res) {
      if (err) {
        return done()
      }

      return done(new Error('Should have failed invoking Beerule: channel mismatch'))
    })
  })

  it('should create a write beerule without error', function(done) {
    bclient.createBeerule(testwrite, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('write')
      done()
    })
  })

  it('should create a write beerule with value without error', function(done) {
    bclient.createBeerule(testwritewithval, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res).to.have.nested.property('action.value')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('write')
      done()
    })
  })

  it('should create an sms beerule without error', function(done) {
    bclient.createBeerule(testsms, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('sms')
      done()
    })
  })

  it('should create an email beerule without error', function(done) {
    bclient.createBeerule(testemail, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('email')
      beeruleid = res._id
      done()
    })
  })

  it('should create a webhook beerule without error', function(done) {
    bclient.createBeerule(testwebhook, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('webhook')
      done()
    })
  })

  it('should create a FCM beerule without error', function(done) {
    bclient.createBeerule(testfcm, function(err, res) {
      if (err) {
        return done(err)
      }

      expect(res).to.have.property('name')
      expect(res).to.have.property('owner')
      expect(res).to.have.nested.property('action.type')
      expect(res.owner).to.be.equal('bbt_test')
      expect(res.action.type).to.be.equal('fcm')
      done()
    })
  })

  it('It should get a beerule by id without errors', function (done) {

    bclient.getBeerule(beeruleid, function (err, doc) {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc._id, beeruleid, 'Must get same id as requested')
        assert.equal(doc.owner, 'bbt_test', 'Owner mismatch')
        assert.equal(doc.action.type, 'email', 'Type must be email')
        done()
      }
    })
  })

  it('It should disable a beerule by id without errors', function (done) {

    bclient.setBeeruleStatus(beeruleid, false, function (err, doc) {
      if (err) {
        return done(err)
      } else {
        assert.equal(doc._id, beeruleid, 'Must get same id as requested')
        assert.equal(doc.owner, 'bbt_test', 'Owner mismatch')
        assert.equal(doc.action.type, 'email', 'Type must be email')
        assert.equal(doc.enabled, false, 'Beerule must be disabled now')
        done()
      }
    })
  })

  it('should fail invoking disabled beerule', function(done) {
    bclient.invokeBeerule(beeruleid, {
      channel: 'channeltest',
      resource: 'res1',
      data: 123
    }, function(err, res) {

      if (err) {
        return done()
      }

      return done(new Error('Should have failed invoking disabled Beerule'))
    })
  })

  it('It should fail getting a beerule with wrong id', function (done) {

    bclient.getBeerule('fakeid', function (err, doc) {
      if (err) {
        return done()
      } else {
        done(new Error('Must not be able to request a beerule with fake id'))
      }
    })
  })

  it('It should get all beerules without errors', function (done) {

    bclient.getBeerules(function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 8, 'Must get total of 8 beerules')
        done()
      }
    })
  })

  it('It should get all beerules without errors - empty argument', function (done) {

    bclient.getBeerules({}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 8, 'Must get total of 8 beerules')
        done()
      }
    })
  })

  it('It should get all beerules without errors - null argument', function (done) {

    bclient.getBeerules(null, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 8, 'Must get total of 8 beerules')
        done()
      }
    })
  })

  it('It should get all publish beerules without errors', function (done) {

    bclient.getBeerules({type: 'publish'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 2, 'Must get total of 2 beerules')
        done()
      }
    })
  })

  it('It should get all write beerules without errors', function (done) {

    bclient.getBeerules({type: 'write'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 2, 'Must get total of 2 beerules')
        done()
      }
    })
  })

  it('It should get all sms beerules without errors', function (done) {

    bclient.getBeerules({type: 'sms'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get all email beerules without errors', function (done) {

    bclient.getBeerules({type: 'email'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get all webhook beerules without errors', function (done) {

    bclient.getBeerules({type: 'webhook'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get all FCM beerules without errors', function (done) {

    bclient.getBeerules({type: 'fcm'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get one publish beerule with write trigger', function (done) {

    bclient.getBeerules({type: 'publish', event: 'write'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get one write beerule with publish trigger', function (done) {

    bclient.getBeerules({type: 'write', event: 'publish'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get one sms beerule connect trigger', function (done) {

    bclient.getBeerules({type: 'sms', event: 'connect'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get one email beerule write trigger', function (done) {

    bclient.getBeerules({type: 'email', event: 'write'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 1, 'Must get total of 1 beerules')
        done()
      }
    })
  })

  it('It should get five beerules with write trigger', function (done) {

    bclient.getBeerules({event: 'write'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 5, 'Must get total of 5 beerules')
        done()
      }
    })
  })

  it('It should get two beerules with publish trigger', function (done) {

    bclient.getBeerules({event: 'publish'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 2, 'Must get total of 2 beerules')
        done()
      }
    })
  })

  it('It should get 8 beerules with trigger channel test', function (done) {

    bclient.getBeerules({channel: 'channeltest'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 8, 'Must get total of 8 beerules')
        done()
      }
    })
  })

  it('It should get 8 beerules with trigger resource res1', function (done) {

    bclient.getBeerules({resource: 'res1'}, function (err, docs) {
      if (err) {
        return done(err)
      } else {
        assert.equal(docs.length, 8, 'Must get total of 8 beerules')
        done()
      }
    })
  })

  it('It should fail creating beerule with wildcard trigger channel and resource', function (done) {

    bclient.createBeerule(testwildcards, function(err, res) {
      if (err) {
        return done()
      } else {
        done(new Error('Must not be possible to query beerules with trigger channel and resource set to wirldcard'))
      }
    })
  })

  it('It should fail creating beerule with explicit (wrong) owner', function (done) {
    bclient.createBeerule(testwithowner, function(err, res) {
      if (err) {
        return done()
      } else {
        done(new Error('Must not be possible to create beerule with wrong owner'))
      }
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
      {resource: 'res1', data: 11},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should publish to BBT without error', function(done) {
    bclient.publish({channel: 'channeltest', resource: 'res1', data: 111}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })
})

describe('beebotte.rest read/write operations IAM Token', function() {
  this.timeout(15000)
  var bclientread, bclientwrite
  before(function() {
    bclientread = createConnectionIAMToken(iamtokenread)
    bclientwrite = createConnectionIAMToken(iamtokenwrite)
  })

  it('should write to BBT without error', function(done) {
    bclientwrite.write({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should fail writing to an unauthorized resource', function(done) {
    bclientwrite.write({channel: 'test', resource: 'res2', data: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed writing to an unauthorized resource'))
    })
  })

  it('should fail writing to an unauthorized channel', function(done) {
    bclientwrite.write({channel: 'test', resource: 'res1', data: 1}, function(err, res) {
      if (err) {
        console.log(err)
        return done()
      }
      done(new Error('Should have failed writing to an unauthorized channel'))
    })
  })

  it('should publish to BBT without error', function(done) {
    bclientwrite.publish({channel: 'channeltest', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should fail publishing to an unauthorized resource', function(done) {
    bclientwrite.publish({channel: 'channeltest', resource: 'res2', data: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed writing to an unauthorized resource'))
    })
  })

  it('should fail publishing to an unauthorized channel', function(done) {
    bclientwrite.publish({channel: 'channeltest2', resource: 'res1', data: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed writing to an unauthorized channel'))
    })
  })

  it('should fail reading using write only IAM token', function(done) {
    bclientwrite.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed reading using write only token'))
    })
  })

  it('should read from BBT without error', function(done) {
    bclientread.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done(err)
      expect(res).to.have.length(1)
      expect(res[0]).to.have.property('data')
      expect(res[0].data).to.be.equal(1)
      done()
    })
  })

  it('should fail reading from unauthorized channel', function(done) {
    bclientread.read({channel: 'test', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed reading from unauthorized channel'))
    })
  })

  it('should write to BBT 1 record without error', function(done) {
    bclientwrite.writeBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1}
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.have.length(1)
      done()
    })
  })

  it('should fail writing to multiple resources when unauthorized on any of them', function(done) {
    bclientwrite.writeBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed bulk writing when not authorized on all resources'))
    })
  })

  it('should publish to BBT 1 record without error', function(done) {
    bclientwrite.publishBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 11}
    ]}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      done()
    })
  })

  it('should fail publishing to multiple resources when unauthorized on any of them', function(done) {
    bclientwrite.publishBulk({channel: 'channeltest', records: [
      {resource: 'res1', data: 1},
      {resource: 'res2', data: '2'},
    ]}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed bulk publish when not authorized on all resources'))
    })
  })

  it('should fail writing with read only token', function(done) {
    bclientread.write({channel: 'test', resource: 'res2', data: 1}, function(err, res) {
      if(err) return done()
      done(new Error('Should have failed writing with read only token'))
    })
  })

  it('should delete a record without error', function(done) {
    //old value was 1, add a new value, delete it then verify you get 1 again
    bclientwrite.write({channel: 'channeltest', resource: 'res1', data: 111}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal(true)
      bclientread.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
        if(err) return done(err)
        expect(res).to.have.length(1)
        expect(res[0]).to.have.property('data')
        expect(res[0].data).to.be.equal(111)
        var _id = res[0]._id
        bclientwrite.delete({channel: 'channeltest', resource: 'res1', _id: _id}, function(err, res) {
          if(err) return done(err)
          expect(res).to.have.property('data')
          expect(res.data).to.be.equal(111)
          bclientread.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
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

  it('should update a record without error', function(done) {
    bclientread.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
      if(err) return done(err)
      var _id = res[0]._id
      bclientwrite.update({channel: 'channeltest', resource: 'res1', _id: _id, data: 5}, function(err, res) {
        if(err) return done(err)
        expect(res).to.be.equal(true)
        bclientread.read({channel: 'channeltest', resource: 'res1', limit: 1}, function(err, res) {
          if(err) return done(err)
          expect(res).to.have.length(1)
          expect(res[0]).to.have.property('data')
          expect(res[0].data).to.be.equal(5)
          done()
        })
      })
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

describe('Beebotte IAM Token Full Delete', function() {

  this.timeout(15000)
  var bclientread, bclientwrite, bclient
  before(function() {
    bclientread = createConnectionIAMToken(iamtokenread)
    bclientwrite = createConnectionIAMToken(iamtokenwrite)
    bclient = createConnection()
  })

  it('It should fail reading iamtokens with read only token', (done) => {
    bclientread.getIAMTokens((err, docs) => {
      if (err) {
        return done()
      } else {
        return done(new Error('Should have failed getting IAM tokens using unauthorized token'))
      }
    })
  })

  it('It should fail reading iamtokens with read only token', (done) => {
    bclientwrite.getIAMTokens((err, docs) => {
      if (err) {
        return done()
      } else {
        return done(new Error('Should have failed getting IAM tokens using unauthorized token'))
      }
    })
  })

  it('It should delete all iamtoken for bbt_test owner', (done) => {
    bclient.getIAMTokens((err, docs) => {
      if (err) {
        return done(err)
      } else {
        async.each(docs, (doc, callback) => {
          bclient.deleteIAMToken(doc._id, callback)
        }, err => {
          if (err) {
            return done(err)
          } else {
            done()
          }
        })
      }
    })
  })
})

describe('beebotte.rest delete beerules', function() {
  var bclient = createConnection()

  it('It should delete rule by id without error', function (done) {
    bclient.deleteBeerule(beeruleid, function (err, doc) {
      if (err) {
        return done(err)
      } else {
        bclient.getBeerules(function (err, docs) {
          if (err) {
            return done(err)
          } else {
            assert.equal(docs.length, 7, 'Must get total of 7 beerules')
            done()
          }
        })
      }
    })
  })

  it('It should delete all beerules', function (done) {
    bclient.getBeerules(function (err, docs) {
      if (err) {
        return done(err)
      } else {
        async.each(docs, function (doc, callback) {
          bclient.deleteBeerule(doc._id, callback)
        }, function (err) {
          if (err) {
            return done(err)
          } else {
            done()
          }
        })
      }
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

describe('beebotte.connector all protocols user connection management', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should get all user connections without error', function(done) {
    bclient.getUserConnections(function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({userid: '1234567890'}, function(err, res) {
      if(err) return done(err)
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

describe('beebotte.connector websocket user connection management', function() {
  this.timeout(15000)
  var bclient = createConnection()

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({protocol: 'socketio'}, function (err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid without error', function(done) {
    bclient.getUserConnections({userid: '1234567890', protocol: 'socketio'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should get user connections with a given userid and session id without error', function(done) {
    bclient.getUserConnections({userid: '1234567890', sid: 'abcdefg123456', protocol: 'socketio'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.instanceof(Array)
      done()
    })
  })

  it('should drop user connections with a given userid without error', function(done) {
    bclient.dropUserConnection({userid: '1234567890', protocol: 'socketio'}, function(err, res) {
      if(err) return done(err)
      expect(res).to.be.equal('')
      done()
    })
  })

  it('should drop user connections with a given userid and session id without error', function(done) {
    bclient.dropUserConnection({userid: '1234567890', sid: 'abcdefg123456', protocol: 'socketio'}, function(err, res) {
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
