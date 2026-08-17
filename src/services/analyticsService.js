const { STATE_VALUES } = require('../constants/dataContract');
const state_penalty = Object.freeze({ NORMAL: 0, WARNING_VIBRATION: 28, WARNING_SOUND: 28, WARNING_TEMP: 30, CRITICAL_VIB_SOUND: 50, CRITICAL_VIB_TEMP: 55, CRITICAL_SOUND_TEMP: 55, CRITICAL_ALL: 80 });
function risk_level(health_score) { if (health_score >= 80) return 'LOW'; if (health_score >= 60) return 'MEDIUM'; if (health_score >= 40) return 'HIGH'; return 'CRITICAL'; }
function probable_fault(state) {
  if (state === 'NORMAL') return 'NONE';
  if (state === 'WARNING_TEMP') return 'OVERHEATING';
  if (state === 'WARNING_VIBRATION') return 'EXCESSIVE_VIBRATION';
  if (state === 'WARNING_SOUND') return 'MECHANICAL_ABNORMALITY';
  if (state === 'CRITICAL_VIB_TEMP' || state === 'CRITICAL_SOUND_TEMP') return 'OVERHEATING';
  if (state === 'CRITICAL_VIB_SOUND') return 'LOOSE_COMPONENT';
  return 'UNKNOWN';
}
function recommendation(fault) { return ({ NONE: 'Continue normal monitoring.', OVERHEATING: 'Inspect cooling, load, and temperature sources.', EXCESSIVE_VIBRATION: 'Inspect motor and rotating components.', MECHANICAL_ABNORMALITY: 'Inspect mechanical components and sound sources.', LOOSE_COMPONENT: 'Inspect and secure loose components.', UNKNOWN: 'Stop and inspect the machine before continued operation.' })[fault]; }
function trend(previous_health_score, health_score) { if (previous_health_score === null || previous_health_score === undefined) return 'STABLE'; if (health_score > previous_health_score + 3) return 'RISING'; if (health_score < previous_health_score - 3) return 'FALLING'; return 'STABLE'; }
function analyze(raw, previous_health_score = null) {
  if (!STATE_VALUES.includes(raw.state)) throw new Error('Cannot analyze invalid state');
  const health_score = Math.max(0, Math.min(100, 100 - state_penalty[raw.state]));
  const fault = probable_fault(raw.state);
  return { health_score, risk_level: risk_level(health_score), trend: trend(previous_health_score, health_score), anomaly: raw.state !== 'NORMAL', probable_fault: fault, recommendation: recommendation(fault) };
}
module.exports = { analyze };
