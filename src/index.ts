import cluster from "cluster";
import { Client, Room } from "colyseus.js";

import { WorkerStats } from "./types";
import { getArguments } from "./cli";
import * as rendering from "./rendering";
import { debounce } from "./utils";

let {
    endpoint,
    roomName,
    numClients,
    delay,
    scripting,
    threads,
} = getArguments();

if (cluster.isMaster) {
    // allow to display errors that breaks the rendering.
    const error = console.error;
    process.on("uncaughtException", (e) => {
        rendering.destroy();
        error(e);
        process.exit();
    });

    //
    // The master process only renders data received from forks.
    //
    rendering.setup(endpoint, roomName, numClients * threads);

    let workers: {[id: string]: WorkerStats} = {};

    const updateStats = debounce(() => {
        // re-evaluate totals
        const totalStats = { bytesReceived: 0, bytesSent: 0, clientsConnected: 0 };

        for (let workerId in workers) {
            totalStats.bytesReceived += workers[workerId].bytesReceived;
            totalStats.bytesSent += workers[workerId].bytesSent;
            totalStats.clientsConnected += workers[workerId].clientsConnected;
        }

        rendering.render(totalStats);
    }, 250);

    const onMasterReceivedMessage = (payload: any) => {
        switch (payload.type) {
            case "console":
                console[payload.method](...payload.args);
                break;

            case "error":
                rendering.error(payload.message)
                break;

            case "updateSerializer":
                rendering.updateSerializer(payload.message)
                break;

            case "stats":
                const [workerId, stats] = payload.message;
                workers[workerId] = stats;
                updateStats();
                break;
        }
    }

    // create forks
    for (let i = 0; i < threads; i++) {
        const forked = cluster.fork();
        forked.process.on("message", onMasterReceivedMessage);
        workers[forked.id] = { bytesReceived: 0, bytesSent: 0, clientsConnected: 0 };
    }

} else {
    //
    // Each fork process is going to spawn `numClients`
    //
    const connections: Room[] = [];

    const stats: WorkerStats = {
        bytesReceived: 0,
        bytesSent: 0,
        clientsConnected: 0
    };

    const handleError = (error) =>
        process.send({ type: "error", message: { code: error.code, message: error.message } });

    const updateSerializer = (serializerId) =>
        process.send({ type: "updateSerializer", message: serializerId });

    const updateClientsConnected = () => {};
        // process.send({ type: "clientsConnected", message: stats.clientsConnected });

    // update stats at every second
    setInterval(() =>
        process.send({ type: "stats", message: [process.pid, stats] }), 1000);

    // Trap console methods to forward message to master process
    console.log = (...args: any[]) =>
        process.send({ type: "console", method: "log", args });

    console.warn = (...args: any[]) =>
        process.send({ type: "console", method: "warn", args });

    console.error = (...args: any[]) =>
        process.send({ type: "console", method: "error", args });

    (async () => {
        const client = new Client(endpoint);

        for (let i = 0; i < numClients; i++) {
            const options = (typeof (scripting.requestJoinOptions) === "function")
                ? await scripting.requestJoinOptions.call(client, i)
                : {};

            client.joinOrCreate(roomName, options).then(room => {
                connections.push(room);

                updateSerializer(room.serializerId);

                const ws: WebSocket = (room.connection.transport as any).ws;
                ws.addEventListener('message', (event) => {
                    stats.bytesReceived += new Uint8Array(event.data).length;
                });

                // overwrite original send function to trap sent bytes.
                const _send = ws.send;
                ws.send = function (data: ArrayBuffer) {
                    stats.bytesSent += data.byteLength;
                    _send.call(ws, data);
                }

                stats.clientsConnected++;
                updateClientsConnected();

                room.onError.once(handleError);

                room.onLeave.once(() => {
                    stats.clientsConnected--;
                    updateClientsConnected();
                });

                if (scripting.onJoin) {
                    scripting.onJoin.call(room);
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

}
