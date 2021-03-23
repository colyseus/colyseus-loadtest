import path from "path";
import os from "os";

export function getArguments() {
    const argv = require('minimist')(process.argv.slice(2));
    const packageJson = require(__dirname + "/../package.json");

    if (argv.help) {
        console.log(`${packageJson.name} v${packageJson.version}

Options:
    --endpoint: WebSocket endpoint for all connections (default: ws://localhost:2567)
    --room: room handler name
    --numClients: number of connections to open
    [--delay]: delay to start each connection (in milliseconds)
    [--project]: specify a tsconfig.json file path
    [--threads]: number of threads to distribute clients

Example:
    colyseus-loadtest example/bot.ts --endpoint ws://localhost:2567 --room state_handler`);
        process.exit();
    }

    const endpoint = argv.endpoint || `ws://localhost:2567`;
    const roomName = argv.room;
    const scriptFile = path.resolve(argv._[0]);
    const delay = argv.delay || 0;

    // Distribute provided numClients to threads
    const threads = (argv.threads === 'all')
        ? os.cpus().length
        : argv.threads || 1;

    const numClients = Math.max(1, Math.ceil((argv.numClients || 1) / threads));

    if (!scriptFile) {
        console.error("you must specify a scripting file.");
        process.exit();
    }
    const scripting = require(scriptFile);

    if (!roomName) {
        console.error("--room options is required.");
        process.exit();
    }

    return {
        endpoint,
        roomName,
        numClients,
        delay,
        scripting,
        threads,
    };
}

