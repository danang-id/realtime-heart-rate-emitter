#!/usr/bin/env node
import axios from 'axios'
import dotenv from 'dotenv'
import WebSocket from 'ws'
import { prompt, Separator } from 'inquirer'
import ora from 'ora'

dotenv.config()
const ioSpinner = ora()
const httpURI = process.env.BASE_URL || 'http://localhost:45080'
const socketURI = httpURI.replace('http', 'ws')
let socket: WebSocket;

ioSpinner.start('Getting devices list...')

function createPayload(event: string, data?: any) {
	return JSON.stringify({ event, data })
}

function randomPulse(): number {
	return Math.floor(Math.random() * 45) + 55
}

function main(deviceId: number) {
	const client = axios.create({ baseURL: httpURI })
	const clientSpinner = ora()
	const params = {
		deviceId,
		pulse: randomPulse(),
		timestamp: new Date().getTime()
	}
	clientSpinner.start('Emitting data...')
	client
		.get('emit-pulse', { params })
		.then(data => {
			clientSpinner.succeed(
				'Emit SUCCESS : Device ID ' +
					params.deviceId +
					', Heart Rate ' +
					params.pulse +
					', Time Stamp ' +
					params.timestamp
			)
		})
		.catch(error => {
			clientSpinner.fail('Emit ERROR   : ' + error.message)
		})
}

function onResponseEvent(event: string, data?: any) {
	switch (event) {
		case 'onConnection':
			socket.send(createPayload('onRequestDevices'))
			break;
		case 'onRetrieveDevices':
			ioSpinner.stop()
			const devices: any[] = data
			const choices: any[] = []
			for (const device of devices) {
				choices.push({
					name: device.name,
					value: device.id,
					short: device.name
				})
			}
			choices.push(new Separator())
			choices.push({
				name: 'Exit',
				value: -1,
				short: 'Test cancelled'
			})
			prompt({
				type: 'list',
				name: 'deviceId',
				message: "Please select the device you'd like to test",
				choices
			}).then((deviceIdAnswer: any) => {
				const { deviceId } = deviceIdAnswer
				if (deviceId === -1) {
					process.exit(0)
				}
				prompt({
					type: 'input',
					name: 'times',
					default: 0,
					message: 'How many times the test should run? (0 = forever)'
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
			const message = data.message
			ioSpinner.fail(message)
			process.exit(1)
			break
	}
}

function start() {
	socket = new WebSocket(socketURI)
	socket.onopen = () => {
		socket.send(createPayload('onConnection'))
	}
	socket.onmessage = payload => {
		try {
			const { event, data } = JSON.parse(payload.data.toString());
			if (!event) {
				return;
			}
			onResponseEvent(event, data);
		} catch (error) {
			onResponseEvent('onError', error);
		}
	}
}

start()
