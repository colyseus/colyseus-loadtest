# colyseus-loadtest

Utility tool for load testing Colyseus.

## Usage

```
npm install -g colyseus-loadtest
```

```
$ colyseus-loadtest --help
colyseus-loadtest v0.1.5

Options:
    --endpoint: WebSocket endpoint for all connections (default: ws://localhost:2567)
    --room: room handler name
    --numClients: number of connections to open

Example:
    colyseus-loadtest example/bot.ts --endpoint ws://localhost:2567 --room state_handler
```

## License

MIT.
