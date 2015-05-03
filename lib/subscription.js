"use strict";

/** @constructor */
function Subscription (args, fct, bbt) {
  this.eid = args.channel + bbt.seperator + args.resource;
  this.channel = args.channel;
  this.resource = args.resource;
  this.bbt = bbt;
  this.fct = fct;
  this.subscribed = false;
  this.write = args.write === true; // default false
  this.read  = args.read === true; //default false
  this.writePermission = false;
  this.readPermission = false;
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
Subscription.prototype.update = function(args) {
  //set defaults
  args.read = (typeof( args.read ) === 'undefined' ) ? true : args.read === true; //default true
  args.write = args.write === true; // default false

  if( args.read === this.read && args.write === this.write ) return false; // skip same permissions
  // Permissions changed: 
  this.subscribed = false;
  if( args.read ) {
    this.setReadPermission();
  } else {
    this.resetReadPermission();
  }

  if( args.write ) {
    this.setWritePermission();
  } else {
    this.resetWritePermission();
  }

  return true;
}

Subscription.prototype.setReadPermission = function(){
  this.readPermission = true;
  this.read = true;
}

Subscription.prototype.setWritePermission = function(){
  this.writePermission = true;
  this.write = true;
}

Subscription.prototype.resetReadPermission = function(){
  this.readPermission = false;
  this.read = false;
}

Subscription.prototype.resetWritePermission = function(){
  this.writePermission = false;
  this.write = false;
}

//Turns on the subscribed status of this channel with the given permissions
Subscription.prototype.subscribe = function(){
  this.subscribed = true;
  if(this.read === true) this.setReadPermission();
  if(this.write === true) this.setWritePermission(); 
}

//Unsubscribes from the channel! this revoques any permission granted to the channel
Subscription.prototype.unsubscribe = function() {
  this.subscribed = false;
  this.resetReadPermission();
  this.resetWritePermission();
}

//Returns true if the channel has write permission
Subscription.prototype.hasWritePermission = function() {
  return this.writePermission;
}

//Returns true if the channel has read permission
Subscription.prototype.hasReadPermission = function() {
  return this.readPermission;
}

module.exports = Subscription;