"use strict";

/** @constructor */
function Subscription (args, fct, bbt) {
  this.eid = args.channel + bbt.seperator + args.resource;
  this.channel = args.channel;
  this.resource = args.resource;
  this.bbt = bbt;
  this.fct = fct;
  this.subscribed = false;
  this.write = args.write || false;
  this.read = args.read || false;
  this.writePermission = false;
  this.readPermission = false;
}

Subscription.prototype.update = function(args) {

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