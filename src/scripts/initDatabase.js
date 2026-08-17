const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

async function main() {
  const schema = await fs.readFile(path.resolve(__dirname, '../../sql/schema.sql'), 'utf8');
  const seed = await fs.readFile(path.resolve(__dirname, '../../sql/seed.sql'), 'utf8');
  const connection = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, multipleStatements: true });
  try {
    await connection.query(schema);
    await connection.query(seed);
    console.log('UdyamSense database schema and default M001 machine are ready.');
  } finally { await connection.end(); }
}
main().catch((error) => { console.error(`Database initialization failed: ${error.message}`); process.exitCode = 1; });
