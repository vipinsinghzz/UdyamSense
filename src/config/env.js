require('dotenv').config();

function number(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric`);
  return value;
}

module.exports = {
  port: number('PORT', 5000),
  mqtt_broker_url: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
  mqtt_topic: process.env.MQTT_TOPIC || 'machine/health',
  frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  db: {
    host: process.env.DB_HOST || 'localhost', port: number('DB_PORT', 3306),
    database: process.env.DB_NAME || 'udyamsense', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', waitForConnections: true,
    connectionLimit: number('DB_CONNECTION_LIMIT', 10), queueLimit: 0
  }
};
