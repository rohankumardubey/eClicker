const SessionsManager = require('./SessionsManager');
const SessionTokenManager = require('./SessionTokenManager');
const DeviceTokenManager = require('./DeviceTokenManager');

class MobileClient {
	constructor(websocket) {
		this.websocket = websocket;
		this.deviceId = null;
		this.session = null;
		this.bindHandlers();
	}

	bindHandlers() {
		this.websocket.on("message", this.onMessage.bind(this));
		this.websocket.on("close", this.onClose.bind(this));
	}

	onClose() {
		if(this.session != null) {
			this.session.removeSessionClient(this);
		}
	}

	onMessage(message) {
		console.log(message);

		message = JSON.parse(message);
		switch(message.messageType) {
			case "DEVICE_JOIN":
				let deviceId = DeviceTokenManager.retrieveDeviceId(message.messageData);
				if(deviceId == null) {
					this.websocket.send(JSON.stringify({
						messageType: "DEVICE_JOIN",
						messageData: {
							status: "ERROR",
							statusExtended: "DEVICE_TOKEN_INVALID"
						}
					}));
					return;
				}

				this.deviceId = deviceId;
				this.websocket.send(JSON.stringify({
					messageType: "DEVICE_JOIN",
					messageData: {
						status: "OK"
					}
				}));
				break;

			case "SESSION_JOIN":
				if(this.deviceId == null) {
					this.websocket.send(JSON.stringify({
						messageType: "SESSION_JOIN",
						messageData: {
							status: "ERROR",
							statusExtended: "DEVICE_NOT_IDENTIFIED"
						}
					}));
					return;
				}

				switch(message.messageData.authenticationType) {
					case "sessionKey":
						let sessionId = message.messageData.sessionId;
						if(SessionsManager.existsSession(sessionId)) {
							if(message.messageData.sessionKeys != null && message.messageData.sessionKeys.length == 2) {
								let sessionKeyA = message.messageData.sessionKeys[0];
								let sessionKeyB = message.messageData.sessionKeys[1];
								let session = SessionsManager.getSession(sessionId);

								if (session.checkAuthenticatorCode(sessionKeyA, sessionKeyB)) {
									this.session = session;
									this.session.addSessionClient(this);
									this.websocket.send(JSON.stringify({
										messageType: "SESSION_JOIN",
										messageData: {
											status: "OK",
											statusExtended: {
												"sessionId": sessionId,
												"sessionToken": SessionTokenManager.generateSessionToken(sessionId, this.deviceId)
											}
										}
									}));
								} else {
									this.websocket.send(JSON.stringify({
										messageType: "SESSION_JOIN",
										messageData: {
											status: "ERROR",
											statusExtended: "AUTHENTICATOR_CODE_EXPIRED"
										}
									}));
								}
							} else {
								this.websocket.send(JSON.stringify({
									messageType: "SESSION_JOIN",
									messageData: {
										status: "ERROR",
										statusExtended: "AUTHENTICATOR_CODE_INVALID"
									}
								}));
							}
						} else {
							this.websocket.send(JSON.stringify({
								messageType: "SESSION_JOIN",
								messageData: {
									status: "ERROR",
									statusExtended: "SESSION_EXPIRED"
								}
							}));
						}
						break;

					case "sessionToken":
						let sessionData = SessionTokenManager.retrieveSessionDevice(message.messageData.sessionToken);
						if(sessionData != null) {
							if(sessionData.deviceId == this.deviceId) {
								if (SessionsManager.existsSession(sessionData.sessionId)) {
									this.session = SessionsManager.getSession(sessionData.sessionId);
									this.session.addSessionClient(this);
									this.websocket.send(JSON.stringify({
										messageType: "SESSION_JOIN",
										messageData: {
											status: "OK"
										}
									}));
								} else {
									this.websocket.send(JSON.stringify({
										messageType: "SESSION_JOIN",
										messageData: {
											status: "ERROR",
											statusExtended: "SESSION_EXPIRED"
										}
									}));
								}
							} else {
								this.websocket.send(JSON.stringify({
									messageType: "SESSION_JOIN",
									messageData: {
										status: "ERROR",
										statusExtended: "AUTHENTICATOR_CODE_INVALID"
									}
								}));
							}
						} else {
							this.websocket.send(JSON.stringify({
								messageType: "SESSION_JOIN",
								messageData: {
									status: "ERROR",
									statusExtended: "AUTHENTICATOR_CODE_INVALID"
								}
							}));
						}
						break;

					default:
						this.websocket.send(JSON.stringify({
							messageType: "SESSION_JOIN",
							messageData: {
								status: "ERROR",
								statusExtended: "UNSUPPORTED_AUTHENTICATION_METHOD"
							}
						}));
						break;
				}
				break;

			case "SEND_QUESTION":
				break;
		}
	}
}

module.exports = MobileClient;