'use strict'

var DEFAULT_SUBSCRIBE_TIMEOUT = 6000 // 6 seconds

/** @constructor */
function Subscription (args, fct, bbt) {

  this.eid = args.channel + bbt.seperator + args.resource
  this.channel = args.channel
  this.resource = args.resource
  this.bbt = bbt
  this.fct = fct
  this.subscribed = false
  this.write = args.write === true // default false
  this.read  = args.read === true //default false
  this.writePermission = false
  this.readPermission = false
}

Subscription.prototype.setSubscribeTimer = function (timeout) {
  var self = this
  self.subscriptionTimer = setTimeout(function () {
    self.bbt.emit(
      'subscribeError',
      new Error('Subscription request timed out! Please try again later!'),
      self
    )
  }, timeout || DEFAULT_SUBSCRIBE_TIMEOUT)
}

Subscription.prototype.setUnsubscribeTimer = function (timeout) {
  var self = this
  self.unsubscriptionTimer = setTimeout(function () {
    self.bbt.emit(
      'unsubscribeError',
      new Error('Unsubscription request timed out! Please try again later!'),
      self
    )
  }, timeout || DEFAULT_SUBSCRIBE_TIMEOUT)
}

Subscription.prototype.unsetSubscribeTimer = function () {
  clearTimeout(this.subscriptionTimer)
  this.subscriptionTimer = undefined
}

Subscription.prototype.unsetUnsubscribeTimer = function (timeout) {
  clearTimeout(this.unsubscriptionTimer)
  this.unsubscriptionTimer = undefined
}

/**
 * Updates the subscription with new permissions. Returns true is new permissions
 * changed, false otherwise.
 *
 * @param {Object} args: {
 *   {boolean, optional} read: indicates if read permission is set
 *   {boolean, optional} write: indicates if write permission is set
 * }
 * @return true if new permissions differ from existing ones, false othermise.
 */
Subscription.prototype.update = function (args) {

  //set defaults
  args.read = (typeof args.read) === 'undefined' ? true : args.read === true //default true
  args.write = args.write === true // default false

  if (args.read === this.read && args.write === this.write) {
    return false // skip same permissions
  }

  // Permissions changed:
  this.subscribed = false

  if (args.read) {
    this.setReadPermission()
  } else {
    this.resetReadPermission()
  }

  if (args.write) {
    this.setWritePermission()
  } else {
    this.resetWritePermission()
  }

  return true
}

/**
 * Sets read permission to true.
 **/
Subscription.prototype.setReadPermission = function () {
  this.readPermission = true
  this.read = true
}

/**
 * Sets write permission to true.
 **/
Subscription.prototype.setWritePermission = function () {
  this.writePermission = true
  this.write = true
}

/**
 * Sets read permission to false.
 **/
Subscription.prototype.resetReadPermission = function () {
  this.readPermission = false
  this.read = false
}

/**
 * Sets write permission to false.
 **/
Subscription.prototype.resetWritePermission = function () {
  this.writePermission = false
  this.write = false
}

//Turns on the subscribed status of this channel with the given permissions
Subscription.prototype.subscribe = function () {
  // it the timer is not set, then it timed out already.
  if (this.subscriptionTimer) {
    // clear the timer and set it to undefined
    clearTimeout(this.subscriptionTimer)
    this.subscriptionTimer = undefined

    // subscription succeeded, mark this
    this.subscribed = true

    // set permissions accordingly
    if (this.read === true) {
      this.setReadPermission()
    }

    if (this.write === true) {
      this.setWritePermission()
    }
  }
}

//Unsubscribes from the channel! this revoques any permission granted to the channel
Subscription.prototype.unsubscribe = function () {
  if (this.unsubscriptionTimer) {
    clearTimeout(this.unsubscriptionTimer)
    this.unsubscriptionTimer = undefined
    this.subscribed = false
    this.resetReadPermission()
    this.resetWritePermission()
  }
}

//Returns true if the channel has write permission
Subscription.prototype.hasWritePermission = function () {
  return this.writePermission
}

//Returns true if the channel has read permission
Subscription.prototype.hasReadPermission = function () {
  return this.readPermission
}

module.exports = Subscription
