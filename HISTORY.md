History
=======
## 1.6.0
* Support creation of FCM Beerules [#39](https://github.com/beebotte/bbt_node/issues/39)

## 1.5.0
* Specify ACL resources in IAM Token creation and update [#38](https://github.com/beebotte/bbt_node/issues/38)

## 1.4.1
* Add MQTT and Socketio test cases [#29](https://github.com/beebotte/bbt_node/issues/29)
* Allow MQTT connections to accept `clientid` or `userid` and connection client id

## 1.4.0
* Add MQTT and Socketio test cases [#29](https://github.com/beebotte/bbt_node/issues/29)
* Improve code quality and readability [#30](https://github.com/beebotte/bbt_node/issues/30)

## 1.3.0
* Fix [#36](https://github.com/beebotte/bbt_node/issues/36): Add support for Beebotte IAM Token management
* Fix [#35](https://github.com/beebotte/bbt_node/issues/35): Add support for Beerules management
* Enhance MQTT test cases [#29](https://github.com/beebotte/bbt_node/issues/29)
* Update MQTT version in package.json

## 1.2.2
* Fix [#33](https://github.com/beebotte/bbt_node/issues/33): Update read API limit to 50000 records per call

## 1.2.1
* Fix [#32](https://github.com/beebotte/bbt_node/issues/32): update MQTT.js dependency to address CVE-2017-10910

## 1.2.0
* Add `Update` REST API [#27](https://github.com/beebotte/bbt_node/issues/27)
* Add `Delete` REST API [#28](https://github.com/beebotte/bbt_node/issues/28)

## 1.1.0
* Fix [#31](https://github.com/beebotte/bbt_node/issues/31)

## 1.0.1
* Add test cases [#29](https://github.com/beebotte/bbt_node/issues/29)
* Add linting script [#30](https://github.com/beebotte/bbt_node/issues/30)
* Add dev dependencies and npm scripts

## 1.0.0
* update dependencies

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
