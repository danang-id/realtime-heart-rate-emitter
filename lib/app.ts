import fs from 'fs'
import https from 'https'
import path from 'path'
import axios, { AxiosResponse } from 'axios'
import dotenv from 'dotenv'
import WebSocket from 'ws'
import { prompt, Separator } from 'inquirer'
import ora from 'ora'

dotenv.config()

const CLIENT_IDENTIFIER = process.env.CLIENT_IDENTIFIER
const sessionFileLocation: fs.PathLike = path.join(
	__dirname,
	'..',
	'session.json'
)
const ioSpinner = ora()
const httpsAgent = new https.Agent({
	rejectUnauthorized: false,
})
let USE_SESSION_IDENTIFIER: boolean = true
let SESSION_IDENTIFIER: string | null = null
let socket: WebSocket
let httpURI: string

function createPayload(event: string, data?: any) {
	return JSON.stringify(
		USE_SESSION_IDENTIFIER
			? { sessionID: SESSION_IDENTIFIER, event, data }
			: { event, data }
	)
}

function randomPulse(): number {
	return Math.floor(Math.random() * 45) + 55
}

function onInvalidSessionIdentifier() {
	ioSpinner.fail('Current Session Identifier Invalid!')
	console.log(
		'\nPlease restart this app to regenerate a new session identifier.'
	)
	console.log(
		'If this problem persists, please check CLIENT_IDENTIFIER config in the .env file.'
	)
	fs.unlinkSync(sessionFileLocation)
	process.exit(9)
}

function main(deviceId: string) {
	const client = axios.create({ baseURL: httpURI, httpsAgent })
	const clientSpinner = ora()
	const params = {
		deviceId,
		pulse: randomPulse(),
		timestamp: new Date().getTime(),
	}
	clientSpinner.start('Emitting data...')
	client
		.get('emit-pulse', { params })
		.then((data) => {
			clientSpinner.succeed(
				'Emit SUCCESS : Device ID ' +
					params.deviceId +
					', Heart Rate ' +
					params.pulse +
					', Time Stamp ' +
					params.timestamp
			)
		})
		.catch((error) => {
			console.log(error)
			clientSpinner.fail('Emit ERROR   : ' + error.message)
		})
}

function onResponseEvent(event: string, data?: any) {
	switch (event) {
		case 'onConnection':
			socket.send(createPayload('onRequestDevices'))
			break
		case 'CONNECTION':
			socket.send(createPayload('DEVICES_REQUEST'))
			break
		case 'onRetrieveDevices':
		case 'DEVICES_RETRIEVE':
			ioSpinner.stop()
			const devices: any[] = data
			const choices: any[] = []
			for (const device of devices) {
				choices.push({
					name: device.name,
					value: !USE_SESSION_IDENTIFIER
						? device.id
						: !!device.old_id
						? device.old_id
						: device._id,
					short: device.name,
				})
			}
			choices.push(new Separator())
			choices.push({
				name: 'Exit',
				value: -1,
				short: 'Test cancelled',
			})
			console.log()
			console.log('Target Address: ' + httpURI)
			prompt({
				type: 'list',
				name: 'deviceId',
				message: "Please select the device you'd like to test",
				choices,
			}).then((deviceIdAnswer: any) => {
				const { deviceId } = deviceIdAnswer
				if (deviceId === -1) {
					console.log()
					process.exit(0)
				}
				prompt({
					type: 'input',
					name: 'times',
					default: 0,
					message:
						'How many times the test should run? (0 = forever)',
				}).then((timesAnswer: any) => {
					let { times } = timesAnswer
					times = parseInt(times)
					let time = 0
					const interval = setInterval(() => {
						main(deviceId)
						if (times !== 0) {
							time++
							if (time === times) {
								clearInterval(interval)
								setTimeout(() => {
									console.log()
									start()
								}, 1000)
							}
						}
					}, 1000)
				})
			})
			break
		case 'onError':
		case 'ERROR':
			const message = data.message
			ioSpinner.fail(message)
			process.exit(2)
			break
		case 'SESSION_INVALID':
			onInvalidSessionIdentifier()
			break
	}
}

function askAddress() {
	console.log()
	prompt({
		type: 'input',
		name: 'httpURI',
		message: 'Enter target address',
		default: process.env.TARGET_ADDR || 'https://jantung.masgendut.com',
	}).then((answer: any) => {
		httpURI = answer.httpURI
		start()
	})
}

async function initialiseSession(forceInitialisation: boolean = false) {
	if (
		USE_SESSION_IDENTIFIER &&
		(SESSION_IDENTIFIER === null || forceInitialisation)
	) {
		try {
			let session = null
			if (fs.existsSync(sessionFileLocation)) {
				const sessionFileContent = fs.readFileSync(
					sessionFileLocation,
					{ encoding: 'utf-8' }
				)
				session = JSON.parse(sessionFileContent)
			} else {
				const client = axios.create({ baseURL: httpURI, httpsAgent })
				const data = { clientId: CLIENT_IDENTIFIER }
				const response = await client.post('register-session', data)
				session = response.data.data
			}
			if (!session._id) {
				onInvalidSessionIdentifier()
			} else {
				const sessionFileContent = JSON.stringify(session, null, 4)
				fs.writeFileSync(sessionFileLocation, sessionFileContent, {
					encoding: 'utf-8',
				})
			}
			SESSION_IDENTIFIER = session._id
		} catch (error) {
			const { response } = error as { response: AxiosResponse }
			if (response.status === 404) {
				USE_SESSION_IDENTIFIER = false
			} else {
				console.log(error)
				process.exit(1)
			}
		}
	}
}

async function start(forceInitialisation: boolean = false) {
	if (httpURI !== void 0) {
		await initialiseSession(forceInitialisation)
		ioSpinner.start('Getting devices list...')
		if (socket !== void 0) {
			USE_SESSION_IDENTIFIER
				? socket.send(createPayload('DEVICES_REQUEST'))
				: socket.send(createPayload('onRequestDevices'))
		} else {
			const socketURI = httpURI.replace('http', 'ws')
			socket = new WebSocket(socketURI, {
				protocolVersion: 13,
				origin: httpURI,
				rejectUnauthorized: false,
			})
			socket.onopen = () => {
				USE_SESSION_IDENTIFIER
					? socket.send(createPayload('CONNECTION'))
					: socket.send(createPayload('onConnection'))
			}
			socket.onmessage = (payload) => {
				try {
					const { event, data } = JSON.parse(payload.data.toString())
					if (!event) {
						return
					}
					onResponseEvent(event, data)
				} catch (error) {
					onResponseEvent('ERROR', error)
				}
			}
		}
	} else {
		askAddress()
	}
}

start().then()
