"use strict"

var crypto = require('crypto')

var Utils = {
  //utility function to HMAC a given string
  hmac: function (key, algo, str) {
    var hmac = crypto.createHmac(algo, key)
    hmac.setEncoding('base64')
    hmac.write(str)
    // you can't read from the stream until you call end()
    hmac.end()
    // read out hmac
    var hash = hmac.read()
    return hash
  }
}

module.exports = Utils
