import util from "util";
import blessed from "blessed";

import { elapsedTime, formatBytes, throttle } from "./utils";
import { WorkerStats } from "./types";

const packageJson = require(__dirname + "/../package.json");

const RENDER_THROTTLE_MS = 100; // re-render the screen only each 100ms to avoid consuming too much CPU

let screen: blessed.Widgets.Screen;
let headerBox: blessed.Widgets.BoxElement;
let clientsBox: blessed.Widgets.BoxElement; 
let processingBox: blessed.Widgets.BoxElement; 
let networkingBox: blessed.Widgets.BoxElement; 
let logBox: blessed.Widgets.BoxElement; 

let successfulConnectionBox: blessed.Widgets.TextElement;
let failedConnectionBox: blessed.Widgets.TextElement;

let clientsConnected = 0;
let clientsFailed = 0;

let loadTestStartTime = Date.now();

const renderThrottled = throttle(() =>
    screen.render(), RENDER_THROTTLE_MS);

export function setup(endpoint: string, roomName: string, numClients: number) {
    screen = blessed.screen({ smartCSR: true });

    headerBox = blessed.box({
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
    });

    successfulConnectionBox = blessed.text({ top: 2, left: 1, tags: true, content: `{yellow-fg}connected:{/yellow-fg} ${clientsConnected}` });
    failedConnectionBox = blessed.text({ top: 3, left: 1, tags: true, content: `{yellow-fg}failed:{/yellow-fg} ${clientsFailed}` });

    clientsBox = blessed.box({
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

    processingBox = blessed.box({
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

    networkingBox = blessed.box({
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

    logBox = blessed.box({
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

    // Trap built-in console log methods.
    console.log = function (...args) {
        logBox.content = args.map(arg => util.inspect(arg)).join(" ") + "\n" + logBox.content;
        renderThrottled();
    };

    console.warn = function (...args) {
        logBox.content = `{yellow-fg}${args.map(arg => util.inspect(arg)).join(" ")}{/yellow-fg}\n${logBox.content}`;
        renderThrottled();
    };

    const error = console.error;
    console.error = function (...args) {
        logBox.content = `{red-fg}${args.map(arg => util.inspect(arg)).join(" ")}{/red-fg}\n${logBox.content}`;
        renderThrottled();
    };

    process.on("uncaughtException", (e) => {
        error(e);
        process.exit();
    });

    // append widgets to the screen.
    screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0)); // Quit on Escape, q, or Control-C.
    screen.title = "@colyseus/loadtest";
    screen.append(headerBox);
    screen.append(clientsBox);
    screen.append(logBox);
    screen.append(processingBox);
    screen.append(networkingBox);
    screen.render();
}

/**
 * Update memory / cpu usage
 */
let startTime = process.hrtime()
let startUsage = process.cpuUsage()

export function render(stats: WorkerStats) {
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

    renderThrottled();

    startTime = process.hrtime()
    startUsage = process.cpuUsage()

    /**
     * Networking
     */
    const bytesReceivedBox = (networkingBox.children[0] as blessed.Widgets.TextElement);
    bytesReceivedBox.content = `{yellow-fg}bytes received:{/yellow-fg} ${formatBytes(stats.bytesReceived)}`

    const bytesSentBox = (networkingBox.children[1] as blessed.Widgets.TextElement);
    bytesSentBox.content = `{yellow-fg}bytes sent:{/yellow-fg} ${formatBytes(stats.bytesSent)}`

    updateClientsConnected(stats.clientsConnected);
}

export function updateSerializer(serializerId) {
    // display serialization method in the UI
    const serializerIdText = (headerBox.children[2] as blessed.Widgets.TextElement);
    serializerIdText.content = `{yellow-fg}serialization method:{/yellow-fg} ${serializerId}`;
}

export function updateClientsConnected(clientsConnected) {
    successfulConnectionBox.content = `{yellow-fg}connected:{/yellow-fg} ${clientsConnected}`;
    renderThrottled();
}

export function error (message) {
    console.error(message);
    clientsFailed++;
    console.log({clientsFailed})
    failedConnectionBox.content = `{red-fg}failed:{/red-fg} ${clientsFailed}`;
    renderThrottled();
}