let io;
function initializeSocketManager(socketServer) {
  io = socketServer;
  io.on('connection', (socket) => {
    socket.on('machine:subscribe', (machine_id) => { if (typeof machine_id === 'string') socket.join(`machine:${machine_id}`); });
  });
}
function emitSensorUpdate(reading) { if (io) io.emit('sensor:update', reading); }
module.exports = { initializeSocketManager, emitSensorUpdate };
