const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { verifyDatabase, pool } = require('./config/database');
const { startMqttClient, stopMqttClient } = require('./mqtt/mqttClient');
const { initializeSocketManager } = require('./sockets/socketManager');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.frontend_url, methods: ['GET'] } });
initializeSocketManager(io);

async function start() {
  await verifyDatabase();
  startMqttClient();
  server.listen(env.port, () => console.log(`UdyamSense backend listening on port ${env.port}`));
}
async function shutdown() { stopMqttClient(); await pool.end(); server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
start();
