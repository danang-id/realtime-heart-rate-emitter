"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = __importDefault(require("axios"));
var dotenv_1 = __importDefault(require("dotenv"));
var socket_io_client_1 = __importDefault(require("socket.io-client"));
var inquirer_1 = require("inquirer");
var ora_1 = __importDefault(require("ora"));
dotenv_1.default.config();
var baseURL = process.env.BASE_URL || 'http://localhost';
var io = socket_io_client_1.default(baseURL);
var ioSpinner = ora_1.default();
ioSpinner.start('Getting devices list...');
function randomPulse() {
    return Math.floor(Math.random() * 45) + 55;
}
function main(deviceId) {
    var client = axios_1.default.create({ baseURL: baseURL });
    var clientSpinner = ora_1.default();
    var params = {
        deviceId: deviceId,
        pulse: randomPulse(),
        timestamp: new Date().getTime()
    };
    clientSpinner.start('Emitting data...');
    client
        .get('emit-pulse', { params: params })
        .then(function (data) {
        clientSpinner.succeed('Emit SUCCESS : Device ID ' +
            params.deviceId +
            ', Heart Rate ' +
            params.pulse +
            ', Time Stamp ' +
            params.timestamp);
    })
        .catch(function (error) {
        clientSpinner.fail('Emit ERROR   : ' + error.message);
    });
}
function onRequestDevices(event) {
    switch (event) {
        case 'onRetrieveDevices':
            ioSpinner.stop();
            var devices = arguments[1];
            var choices = [];
            for (var _i = 0, devices_1 = devices; _i < devices_1.length; _i++) {
                var device = devices_1[_i];
                choices.push({
                    name: device.name,
                    value: device.id,
                    short: device.name
                });
            }
            choices.push(new inquirer_1.Separator());
            choices.push({
                name: 'Exit',
                value: -1,
                short: 'Test cancelled'
            });
            inquirer_1.prompt({
                type: 'list',
                name: 'deviceId',
                message: "Please select the device you'd like to test",
                choices: choices
            }).then(function (deviceIdAnswer) {
                var deviceId = deviceIdAnswer.deviceId;
                if (deviceId === -1) {
                    process.exit(1);
                }
                inquirer_1.prompt({
                    type: 'input',
                    name: 'times',
                    default: 0,
                    message: 'How many times the test should run? (0 = forever)'
                }).then(function (timesAnswer) {
                    var times = timesAnswer.times;
                    times = parseInt(times);
                    var time = 0;
                    var interval = setInterval(function () {
                        main(deviceId);
                        if (times !== 0) {
                            time++;
                            if (time === times) {
                                clearInterval(interval);
                                setTimeout(function () {
                                    console.log();
                                    start();
                                }, 1000);
                            }
                        }
                    }, 1000);
                });
            });
            break;
        case 'onError':
            var message = arguments[1];
            ioSpinner.fail(message);
            break;
    }
}
function start() {
    io.emit('onRequestDevices', onRequestDevices);
}
start();
