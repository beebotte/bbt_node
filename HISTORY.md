History
=======

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
