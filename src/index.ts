import * as path from "path";
import { Client } from "colyseus.js";
const argv = require('minimist')(process.argv.slice(2));

if (argv.help) {
    const packageJson = require(__dirname + "/../package.json");
    console.log(`${packageJson.name} v${packageJson.version}

Options:
    --endpoint: WebSocket endpoint for all connections (default: ws://localhost:2567)
    --room: room handler name
    --numClients: number of connections to open

Example:
    colyseus-loadtest example/bot.ts --endpoint ws://localhost:2567 --room state_handler`);
    process.exit();
}

const endpoint = argv.endpoint || `ws://localhost:2567`;
const roomName = argv.room;
const numClients = argv.numClients || 1;
const scriptFile = path.resolve(argv._[0]);
if (!scriptFile) {
    throw new Error("you must specify a scripting file.");
}
const scripting = require(scriptFile);
const clients: Client[] = [];

if (!roomName) {
    throw new Error("--room options is required.");
}

console.log("----------------------------");
console.log("endpoint:", endpoint);
console.log("room:", roomName);
console.log("numClients:", numClients);
console.log("script:", scriptFile);
console.log("----------------------------");

for (let i = 0; i < numClients; i++) {
    const client = new Client(endpoint);
    clients.push(roomName);

    const room = client.join(roomName);

    if (scripting.onJoin) {
        room.onJoin.add(scripting.onJoin.bind(room));
    }

    if (scripting.onMessage) {
        room.onMessage.add(scripting.onMessage.bind(room));
    }

    if (scripting.onLeave) {
        room.onLeave.add(scripting.onLeave.bind(room));
    }

    if (scripting.onError) {
        room.onError.add(scripting.onError.bind(room));
    }

    if (scripting.onStateChange) {
        room.onStateChange.add(scripting.onStateChange.bind(room));
    }
}