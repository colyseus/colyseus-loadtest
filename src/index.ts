import * as path from "path";
import * as util from "util";
import * as blessed from "blessed";
import { Client, Room } from "colyseus.js";

const argv = require('minimist')(process.argv.slice(2));

const packageJson = require(__dirname + "/../package.json");

if (argv.help) {
    console.log(`${packageJson.name} v${packageJson.version}

Options:
    --endpoint: WebSocket endpoint for all connections (default: ws://localhost:2567)
    --room: room handler name
    --numClients: number of connections to open
    [--delay]: delay to start each connection (in milliseconds)

Example:
    colyseus-loadtest example/bot.ts --endpoint ws://localhost:2567 --room state_handler`);
    process.exit();
}

const endpoint = argv.endpoint || `ws://localhost:2567`;
const roomName = argv.room;
const numClients = argv.numClients || 1;
const scriptFile = path.resolve(argv._[0]);
const delay = argv.delay || 0;
if (!scriptFile) {
    console.error("you must specify a scripting file.");
    process.exit();
}
const scripting = require(scriptFile);
const connections: Room[] = [];

if (!roomName) {
    console.error("--room options is required.");
    process.exit();
}

const screen = blessed.screen({ smartCSR: true });

const headerBox = blessed.box({
    label: ` ⚔  ${packageJson.name} ${packageJson.version} ⚔  `,
    top: 0,
    left: 0,
    width: "70%",
    height: 'shrink',
    children: [
        blessed.text({ top: 1, left: 1, tags: true, content: `{yellow-fg}endpoint:{/yellow-fg} ${endpoint}` }),
        blessed.text({ top: 2, left: 1, tags: true, content: `{yellow-fg}room:{/yellow-fg} ${roomName}` }),
        blessed.text({ top: 3, left: 1, tags: true, content: `{yellow-fg}serialization method:{/yellow-fg} ...` }),
        blessed.text({ top: 4, left: 1, tags: true, content: `{yellow-fg}time elapsed:{/yellow-fg} ...` }),
    ],
    border: { type: 'line' },
    style: {
        label: { fg: 'cyan' },
        border: { fg: 'green' }
    }
})


let clientsConnected = 0;
let clientsFailed = 0;

const successfulConnectionBox = blessed.text({ top: 2, left: 1, tags: true, content: `{yellow-fg}connected:{/yellow-fg} ${clientsConnected}` });
const failedConnectionBox = blessed.text({ top: 3, left: 1, tags: true, content: `{yellow-fg}failed:{/yellow-fg} ${clientsFailed}` });

const clientsBox = blessed.box({
    label: ' clients ',
    left: "70%",
    width: "30%",
    height: 'shrink',
    children: [
        blessed.text({ top: 1, left: 1, tags: true, content: `{yellow-fg}numClients:{/yellow-fg} ${numClients}` }),
        successfulConnectionBox,
        failedConnectionBox
    ],
    border: { type: 'line' },
    tags: true,
    style: {
        label: { fg: 'cyan' },
        border: { fg: 'green' },
    }
})

const processingBox = blessed.box({
    label: ' processing ',
    top: 6,
    left: "70%",
    width: "30%",
    height: 'shrink',
    border: { type: 'line' },
    children: [
        blessed.text({ top: 1, left: 1, tags: true, content: `{yellow-fg}memory:{/yellow-fg} ...` }),
        blessed.text({ top: 2, left: 1, tags: true, content: `{yellow-fg}cpu:{/yellow-fg} ...` }),
        // blessed.text({ top: 1, left: 1, content: `memory: ${process.memoryUsage().heapUsed} / ${process.memoryUsage().heapTotal}` })
    ],
    tags: true,
    style: {
        label: { fg: 'cyan' },
        border: { fg: 'green' },
    }
});

const networkingBox = blessed.box({
    label: ' networking ',
    top: 11,
    left: "70%",
    width: "30%",
    border: { type: 'line' },
    children: [
        blessed.text({ top: 1, left: 1, tags: true, content: `{yellow-fg}bytes received:{/yellow-fg} ...` }),
        blessed.text({ top: 2, left: 1, tags: true, content: `{yellow-fg}bytes sent:{/yellow-fg} ...` }),
        // blessed.text({ top: 1, left: 1, content: `memory: ${process.memoryUsage().heapUsed} / ${process.memoryUsage().heapTotal}` })
    ],
    tags: true,
    style: {
        label: { fg: 'cyan' },
        border: { fg: 'green' },
    }
});

const logBox = blessed.box({
    label: ' logs ',
    top: 7,
    width: "70%",
    padding: 1,
    border: { type: 'line' },
    tags: true,
    style: {
        label: { fg: 'cyan' },
        border: { fg: 'green' },
    },
    // scroll
    scrollable: true,
    input: true,
    alwaysScroll: true,
    scrollbar: {
        style: {
            bg: "green"
        },
        track: {
            bg: "gray"
        }
    },
    keys: true,
    vi: true,
    mouse: true
});

screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0)); // Quit on Escape, q, or Control-C.
screen.title = "@colyseus/loadtest";
screen.append(headerBox);
screen.append(clientsBox);
screen.append(logBox);
screen.append(processingBox);
screen.append(networkingBox);
screen.render();

console.log = function(...args) {
    logBox.content = args.map(arg => util.inspect(arg)).join(" ") + "\n" + logBox.content;
    screen.render();
}
console.warn = function(...args) {
    logBox.content = `{yellow-fg}${args.map(arg => util.inspect(arg)).join(" ")}{/yellow-fg}\n${logBox.content}`;
    screen.render();
}

const error = console.error;
console.error = function(...args) {
    logBox.content = `{red-fg}${args.map(arg => util.inspect(arg)).join(" ")}{/red-fg}\n${logBox.content}`;
    screen.render();
}

process.on("uncaughtException", (e) => {
    error(e);
    process.exit();
});

function formatBytes (bytes) {
    if (bytes < 1024) {
        return `${bytes} b`;

    } else if (bytes < Math.pow(1024, 2)) {
        return `${(bytes / 1024).toFixed(2)} kb`;

    } else if (bytes < Math.pow(1024, 4)) {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }
}

function elapsedTime(inputSeconds) {
    const days = Math.floor(inputSeconds / (60 * 60 * 24));
    const hours = Math.floor((inputSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) / 60);
    const seconds = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) % 60);

    let ddhhmmss = '';

    if (days > 0) { ddhhmmss += days + ' day '; }
    if (hours > 0) { ddhhmmss += hours + ' hour '; }
    if (minutes > 0) { ddhhmmss += minutes + ' minutes '; }
    if (seconds > 0) { ddhhmmss += seconds + ' seconds '; }

    return ddhhmmss || "...";
}

/**
 * Update memory / cpu usage
 */
const loadTestStartTime = Date.now();
let startTime = process.hrtime()
let startUsage = process.cpuUsage()
let bytesReceived: number = 0;
let bytesSent: number = 0;
setInterval(() => {
    /**
     * Program elapsed time
     */
    const elapsedTimeText = (headerBox.children[3] as blessed.Widgets.TextElement);
    elapsedTimeText.content = `{yellow-fg}time elapsed:{/yellow-fg} ${elapsedTime(Math.round((Date.now() - loadTestStartTime) / 1000))}`;

    /**
     * Memory / CPU Usage
     */
    const memoryText = (processingBox.children[0] as blessed.Widgets.TextElement);
    memoryText.content = `{yellow-fg}memory:{/yellow-fg} ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;

    var elapTime = process.hrtime(startTime)
    var elapUsage = process.cpuUsage(startUsage)

    var elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
    var elapUserMS = elapUsage.user / 1000;
    var elapSystMS = elapUsage.system / 1000;
    var cpuPercent = (100 * (elapUserMS + elapSystMS) / elapTimeMS).toFixed(1);

    const cpuText = (processingBox.children[1] as blessed.Widgets.TextElement);
    cpuText.content = `{yellow-fg}cpu:{/yellow-fg} ${cpuPercent}%`;

    screen.render();

    startTime = process.hrtime()
    startUsage = process.cpuUsage()

    /**
     * Networking
     */
    const bytesReceivedBox = (networkingBox.children[0] as blessed.Widgets.TextElement);
    bytesReceivedBox.content = `{yellow-fg}bytes received:{/yellow-fg} ${formatBytes(bytesReceived)}`

    const bytesSentBox = (networkingBox.children[1] as blessed.Widgets.TextElement);
    bytesSentBox.content = `{yellow-fg}bytes sent:{/yellow-fg} ${formatBytes(bytesSent)}`
}, 1000);

function handleError (message) {
    console.error(message);
    clientsFailed++;
    failedConnectionBox.content = `{red-fg}failed:{/red-fg} ${clientsFailed}`;
    screen.render();
}

(async () => {
    for (let i = 0; i < numClients; i++) {
        const client = new Client(endpoint);

        const options = (typeof(scripting.requestJoinOptions) === "function")
            ? await scripting.requestJoinOptions.call(client, i)
            : {};

        client.joinOrCreate(roomName, options).then(room => {
            connections.push(room);

            // display serialization method in the UI
            const serializerIdText = (headerBox.children[2] as blessed.Widgets.TextElement);
            serializerIdText.content = `{yellow-fg}serialization method:{/yellow-fg} ${room.serializerId}`;

            room.connection.ws.addEventListener('message', (event) => {
                bytesReceived += new Uint8Array(event.data).length;
            });

            // overwrite original send function to trap sent bytes.
            const _send = room.connection.ws.send;
            room.connection.ws.send = function (data: ArrayBuffer) {
                bytesSent += data.byteLength;
                _send.call(room.connection.ws, data);
            }

            clientsConnected++;
            successfulConnectionBox.content = `{yellow-fg}connected:{/yellow-fg} ${clientsConnected}`;
            screen.render();

            room.onError.once(handleError);

            room.onLeave.once(() => {
                clientsConnected--;
                successfulConnectionBox.content = `{yellow-fg}connected:{/yellow-fg} ${clientsConnected}`;
                screen.render();
            });

            if (scripting.onJoin) {
                scripting.onJoin.call(room);
            }

            if (scripting.onMessage) {
                room.onMessage(scripting.onMessage.bind(room));
            }

            if (scripting.onLeave) {
                room.onLeave(scripting.onLeave.bind(room));
            }

            if (scripting.onError) {
                room.onError(scripting.onError.bind(room));
            }

            if (scripting.onStateChange) {
                room.onStateChange(scripting.onStateChange.bind(room));
            }
        }).catch((err) => {
            handleError(err);
        });

        if (delay > 0) {
          await (new Promise(resolve => setTimeout(resolve, delay)));
        }
    }
})();
