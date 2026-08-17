const mysql = require('mysql2/promise');
const { db } = require('./env');

const pool = mysql.createPool({ ...db, dateStrings: true, timezone: '+05:30' });
let database_connected = false;

async function verifyDatabase() {
  try {
    await pool.query('SELECT 1');
    database_connected = true;
  } catch (error) {
    database_connected = false;
    console.error('MySQL connection failed:', error.message);
  }
  return database_connected;
}

function isDatabaseConnected() { return database_connected; }
module.exports = { pool, verifyDatabase, isDatabaseConnected };
