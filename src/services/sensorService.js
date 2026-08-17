const { pool } = require('../config/database');
const { fromDatabaseTimestamp, toDatabaseTimestamp } = require('../utils/timestamp');

function mapReading(row) {
  if (!row) return null;
  return { machine_id: row.machine_id, timestamp: fromDatabaseTimestamp(row.timestamp), vibration: Number(row.vibration), sound: Number(row.sound), temperature: Number(row.temperature), state: row.state, health_score: Number(row.health_score), risk_level: row.risk_level, trend: row.trend, anomaly: Boolean(row.anomaly), probable_fault: row.probable_fault, recommendation: row.recommendation };
}
async function ensureMachine(machine_id) {
  const [rows] = await pool.execute('SELECT machine_code FROM machines WHERE machine_code = ? LIMIT 1', [machine_id]);
  return rows.length > 0;
}
async function latestHealthScore(machine_id) {
  const [rows] = await pool.execute('SELECT health_score FROM sensor_readings WHERE machine_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1', [machine_id]);
  return rows.length ? Number(rows[0].health_score) : null;
}
async function saveReading(reading) {
  await pool.execute(`INSERT INTO sensor_readings (machine_id, timestamp, vibration, sound, temperature, state, health_score, risk_level, trend, anomaly, probable_fault, recommendation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [reading.machine_id, toDatabaseTimestamp(reading.timestamp), reading.vibration, reading.sound, reading.temperature, reading.state, reading.health_score, reading.risk_level, reading.trend, reading.anomaly, reading.probable_fault, reading.recommendation]);
  return reading;
}
async function getLatest(machine_id) {
  const [rows] = await pool.execute(`SELECT machine_id, timestamp, vibration, sound, temperature, state, health_score, risk_level, trend, anomaly, probable_fault, recommendation
    FROM sensor_readings WHERE machine_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1`, [machine_id]);
  return mapReading(rows[0]);
}
async function getHistory(machine_id, hours, limit) {
  const safeHours = Number.parseInt(hours, 10);
  const safeLimit = Number.parseInt(limit, 10);

  const [rows] = await pool.execute(
    `SELECT machine_id, timestamp, vibration, sound, temperature, state,
            health_score, risk_level, trend, anomaly, probable_fault, recommendation
     FROM sensor_readings
     WHERE machine_id = ?
       AND timestamp >= DATE_SUB(NOW(), INTERVAL ${safeHours} HOUR)
     ORDER BY timestamp DESC, id DESC
     LIMIT ${safeLimit}`,
    [machine_id]
  );

  return rows.reverse().map(mapReading);
}
module.exports = { ensureMachine, latestHealthScore, saveReading, getLatest, getHistory };
