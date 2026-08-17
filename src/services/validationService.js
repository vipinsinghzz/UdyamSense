const { STATE_VALUES, RISK_LEVEL_VALUES, TREND_VALUES, PROBABLE_FAULT_VALUES } = require('../constants/dataContract');
function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function validateRawPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Payload must be a JSON object';
  for (const field of ['vibration', 'sound', 'temperature']) if (!isFiniteNumber(payload[field])) return `${field} must be a finite number`;
  if (!STATE_VALUES.includes(payload.state)) return `state must be one of: ${STATE_VALUES.join(', ')}`;
  return null;
}
function validateFinalReading(reading) {
  const rawError = validateRawPayload(reading); if (rawError) return rawError;
  if (typeof reading.machine_id !== 'string' || !reading.machine_id.trim()) return 'machine_id is required';
  if (!isFiniteNumber(reading.health_score) || reading.health_score < 0 || reading.health_score > 100) return 'health_score must be between 0 and 100';
  if (!RISK_LEVEL_VALUES.includes(reading.risk_level)) return 'risk_level is invalid';
  if (!TREND_VALUES.includes(reading.trend)) return 'trend is invalid';
  if (typeof reading.anomaly !== 'boolean') return 'anomaly must be boolean';
  if (!PROBABLE_FAULT_VALUES.includes(reading.probable_fault)) return 'probable_fault is invalid';
  if (typeof reading.recommendation !== 'string') return 'recommendation must be a string';
  return null;
}
module.exports = { validateRawPayload, validateFinalReading };
