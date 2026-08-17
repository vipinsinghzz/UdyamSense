const env = require('../config/env');

const AI_API_URL =
  env.ai_api_url || 'http://127.0.0.1:8001';


async function getAIPrediction(
  vibration,
  sound,
  temperature
) {
  const response = await fetch(
    `${AI_API_URL}/predict`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        vibration,
        sound,
        temperature
      })
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `AI API returned ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  if (
    !data ||
    data.success !== true ||
    !data.prediction
  ) {
    throw new Error(
      'Invalid response from AI API'
    );
  }

  return data.prediction;
}


/*
 * Convert the AI fault names into the
 * existing UdyamSense database contract.
 */
function mapProbableFault(
  aiFault
) {
  switch (aiFault) {

    case 'NORMAL':
      return 'NONE';

    case 'EXCESSIVE_VIBRATION':
      return 'EXCESSIVE_VIBRATION';

    case 'OVERHEATING':
      return 'OVERHEATING';

    case 'ABNORMAL_SOUND':
      return 'MECHANICAL_ABNORMALITY';

    case 'MULTI_SENSOR_ABNORMALITY':
      return 'LOOSE_COMPONENT';

    case 'UNKNOWN_ABNORMALITY':
      return 'UNKNOWN';

    default:
      return 'UNKNOWN';
  }
}


/*
 * Calculate the severity of the current
 * machine condition.
 *
 * IMPORTANT:
 *
 * This is NOT the machine health score.
 *
 * It represents how bad the CURRENT
 * reading is.
 *
 * 0  = healthy current condition
 * 100 = extremely abnormal current condition
 */
function calculateConditionSeverity(
  anomalyScore
) {
  const score =
    Number(anomalyScore);

  if (!Number.isFinite(score)) {
    return 0;
  }

  /*
   * Small anomaly scores are treated
   * as normal operating variation.
   *
   * This prevents small sensor noise
   * from damaging machine health.
   */
  const HEALTHY_ZONE = 35;

  if (score <= HEALTHY_ZONE) {
    return 0;
  }

  /*
   * Convert the abnormal portion
   * into a 0-100 severity value.
   *
   * 35 → 0
   * 50 → ~23
   * 70 → ~54
   * 85 → ~77
   * 100 → 100
   */
  const severity =
    (
      (score - HEALTHY_ZONE)
      /
      (100 - HEALTHY_ZONE)
    ) * 100;

  return Math.max(
    0,
    Math.min(
      100,
      severity
    )
  );
}


/*
 * Battery-like machine health.
 *
 * The machine health has MEMORY.
 *
 * It does NOT simply become:
 *
 *     100 - anomalyScore
 *
 * Instead:
 *
 *     previous health
 *            +
 *     current machine condition
 *            ↓
 *     gradual degradation
 *
 *
 * Example:
 *
 * 100 → 98 → 96 → 94 → 91
 *
 * instead of:
 *
 * 100 → 30 → 100
 */
function calculateMachineHealth(
  previousHealthScore,
  anomalyScore,
  aiAnomaly
) {

  /*
   * First reading:
   *
   * Start from a healthy machine.
   */
  let previousHealth =
    previousHealthScore === null ||
    previousHealthScore === undefined
      ? 100
      : Number(previousHealthScore);


  if (!Number.isFinite(previousHealth)) {
    previousHealth = 100;
  }


  previousHealth =
    Math.max(
      0,
      Math.min(
        100,
        previousHealth
      )
    );


  const severity =
    calculateConditionSeverity(
      anomalyScore
    );


  /*
   * Convert current severity into
   * a target health.
   *
   * Severity 0:
   * target = 100
   *
   * Severity 50:
   * target = 75
   *
   * Severity 100:
   * target = 50
   *
   * This intentionally prevents one
   * reading from immediately destroying
   * the machine health.
   */
  const targetHealth =
    100 -
    (severity * 0.50);


  let newHealth;


  /*
   * NORMAL CURRENT CONDITION
   *
   * Recovery is intentionally slow.
   *
   * This gives the health score memory.
   */
  if (severity === 0) {

    const RECOVERY_RATE = 0.025;

    newHealth =
      previousHealth +
      (
        (100 - previousHealth)
        *
        RECOVERY_RATE
      );

  } else {

    /*
     * ABNORMAL CONDITION
     *
     * The more severe the anomaly,
     * the faster the health moves
     * toward the degraded target.
     */

    let degradationRate = 0.08;


    if (severity >= 70) {
      degradationRate = 0.20;
    } else if (severity >= 40) {
      degradationRate = 0.12;
    }


    /*
     * If Isolation Forest itself
     * considers the reading anomalous,
     * slightly increase degradation.
     */
    if (aiAnomaly === true) {
      degradationRate += 0.03;
    }


    newHealth =
      previousHealth +
      (
        (targetHealth - previousHealth)
        *
        degradationRate
      );
  }


  /*
   * Never allow health to leave
   * the valid 0-100 range.
   */
  newHealth =
    Math.max(
      0,
      Math.min(
        100,
        newHealth
      )
    );


  return Number(
    newHealth.toFixed(2)
  );
}


/*
 * Convert machine health into risk.
 *
 * This is based on the LONG-TERM
 * machine health, not just one
 * abnormal reading.
 */
function calculateRiskLevel(
  healthScore
) {

  if (healthScore >= 80) {
    return 'LOW';
  }

  if (healthScore >= 60) {
    return 'MEDIUM';
  }

  if (healthScore >= 40) {
    return 'HIGH';
  }

  return 'CRITICAL';
}


/*
 * Convert the AI result into the
 * existing UdyamSense contract.
 *
 * previousHealthScore is required
 * because health is now stateful.
 */
function mapAIResult(
  aiResult,
  previousHealthScore = null
) {

  const anomalyScore =
    Number(
      aiResult.ai_anomaly_score
    );


  const aiAnomaly =
    Boolean(
      aiResult.ai_anomaly
    );


  const healthScore =
    calculateMachineHealth(
      previousHealthScore,
      anomalyScore,
      aiAnomaly
    );


  const riskLevel =
    calculateRiskLevel(
      healthScore
    );


  return {

    /*
     * This is now the MACHINE HEALTH
     * rather than 100 - anomaly score.
     */
    health_score:
      healthScore,

    /*
     * Keep the current AI anomaly
     * separately.
     */
    anomaly:
      aiAnomaly,

    /*
     * AI anomaly score is not stored
     * in the current V1 database contract,
     * but remains available inside
     * aiResult if needed.
     */
    risk_level:
      riskLevel,

    probable_fault:
      mapProbableFault(
        aiResult.ai_probable_fault
      ),

    recommendation:
      aiResult.ai_recommendation
  };
}


module.exports = {

  getAIPrediction,

  mapAIResult,

  mapProbableFault,

  calculateConditionSeverity,

  calculateMachineHealth,

  calculateRiskLevel
};