const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRawPayload, validateFinalReading } = require('../src/services/validationService');
const { analyze } = require('../src/services/analyticsService');
const { STATE_VALUES } = require('../src/constants/dataContract');
const raw = { vibration: 2.43, sound: 147, temperature: 38.2, state: 'WARNING_VIBRATION' };
test('accepts every frozen V1 state and generates valid analytics', () => { for (const state of STATE_VALUES) { const analytics = analyze({ ...raw, state }); assert.equal(validateFinalReading({ machine_id: 'M001', timestamp: '2026-08-16T15:45:20+05:30', ...raw, state, ...analytics }), null); } });
test('rejects malformed state and sensor values', () => { assert.match(validateRawPayload({ ...raw, state: 'WARNING' }), /state/); assert.match(validateRawPayload({ ...raw, sound: '147' }), /sound/); });
test('V1 risk score boundaries are preserved', () => { assert.equal(analyze({ ...raw, state: 'NORMAL' }).risk_level, 'LOW'); assert.equal(analyze({ ...raw, state: 'WARNING_VIBRATION' }).risk_level, 'MEDIUM'); assert.equal(analyze({ ...raw, state: 'CRITICAL_VIB_SOUND' }).risk_level, 'HIGH'); assert.equal(analyze({ ...raw, state: 'CRITICAL_ALL' }).risk_level, 'CRITICAL'); });
