History
=======

## 0.8.0
* Fix [#16](https://github.com/beebotte/bbt_node/issues/16)
* Fix [#24](https://github.com/beebotte/bbt_node/issues/24)
* Fix [#25](https://github.com/beebotte/bbt_node/issues/25)
* Fix [#26](https://github.com/beebotte/bbt_node/issues/26)
* use version from package.json instead of an explicit version file

## 0.7.5
* Fix [#22](https://github.com/beebotte/bbt_node/issues/22): re-establish support for node version >= 0.10.40
* indicate supported node and npm versions in package.json

## 0.7.4
* Fix [#21](https://github.com/beebotte/bbt_node/issues/21): enable client reconnection after *client.disconnect()* has been called
* Update dependencies
* Update Joi API

## 0.7.3
* Fix [#15](https://github.com/beebotte/bbt_node/issues/15): add support for protocol bridging

## 0.7.2
* Fix [#14](https://github.com/beebotte/bbt_node/issues/14)
* Naming harmonization: use `apiKey` instead of `keyId` in the REST client

## 0.7.1
* Fix [#13](https://github.com/beebotte/bbt_node/issues/13)

## 0.7.0
* Add **update** subscription (private API)
* Improve events workflow for MQTT and Websockets transports
* Ensure responses are JSON formatted in the REST client

## 0.6.5
* Fix endpoint authentication for Socket.io transport when using GET method and userinfo is a JSON object [#11](https://github.com/beebotte/bbt_node/issues/11)

## 0.6.4
* Fix subscriptions with read access set to false in Stream API [#10](https://github.com/beebotte/bbt_node/issues/10)

## 0.6.3
* Add authentication using Channel Token for Socket.io transport

## 0.6.2
* Add authentication using Secret Key for Socket.io transport

## 0.6.1
* Fix unsubscriptions in Stream API [#8](https://github.com/beebotte/bbt_node/issues/8)

## 0.6.0
* Call chaining in Stream API

## 0.5.0
* Addition support for real time Pub/Sub API with Socket.io and MQTT transports [#5](https://github.com/beebotte/bbt_node/issues/5)
* Set code in strict mode
* Updated README 

## 0.4.0

* Addition of Token based authentication for reading, writing and publishing to a channel
* Addition of HISTORY.md file
