const mqtt = require('mqtt');

const env = require('../config/env');

const {
  DEFAULT_MACHINE_ID
} = require('../constants/dataContract');

const {
  validateRawPayload,
  validateFinalReading
} = require('../services/validationService');

const {
  analyze
} = require('../services/analyticsService');

const {
  getAIPrediction,
  mapAIResult
} = require('../services/aiService');

const {
  ensureMachine,
  latestHealthScore,
  saveReading
} = require('../services/sensorService');

const {
  serverTimestamp
} = require('../utils/timestamp');

const {
  emitSensorUpdate
} = require('../sockets/socketManager');


let client;
let mqtt_connected = false;


async function processPayload(message) {

  let raw;

  try {
    raw = JSON.parse(
      message.toString()
    );
  } catch {
    throw new Error(
      'Malformed MQTT JSON'
    );
  }

  const validationError =
    validateRawPayload(raw);

  if (validationError) {
    throw new Error(
      validationError
    );
  }

  const machine_id =
    typeof raw.machine_id === 'string'
    && raw.machine_id.trim()
      ? raw.machine_id.trim()
      : DEFAULT_MACHINE_ID;


  if (
    !await ensureMachine(
      machine_id
    )
  ) {
    throw new Error(
      `Unknown machine: ${machine_id}`
    );
  }


  /*
   * Get the previous health score.
   *
   * We keep this because the existing
   * analytics service calculates the
   * machine trend from the previous
   * health score.
   */
  const previousHealthScore =
    await latestHealthScore(
      machine_id
    );


  /*
   * AI ANALYSIS
   *
   * Send the real sensor values to
   * the Python AI service.
   */
  const aiPrediction =
    await getAIPrediction(
      raw.vibration,
      raw.sound,
      raw.temperature
    );


  /*
   * Convert the Python AI response
   * into the existing UdyamSense
   * database contract.
   */
  const aiAnalytics =
    mapAIResult(
      aiPrediction
    );


  /*
   * Calculate trend using the
   * AI-generated health score.
   *
   * We deliberately keep the existing
   * analytics service only for TREND.
   */
  const existingAnalytics =
    analyze(
      {
        ...raw,
        state: raw.state
      },
      previousHealthScore
    );


  const reading = {

    machine_id,

    timestamp:
      serverTimestamp(),

    vibration:
      raw.vibration,

    sound:
      raw.sound,

    temperature:
      raw.temperature,

    state:
      raw.state,

    /*
     * AI-generated values
     */
    health_score:
      aiAnalytics.health_score,

    risk_level:
      aiAnalytics.risk_level,

    anomaly:
      aiAnalytics.anomaly,

    probable_fault:
      aiAnalytics.probable_fault,

    recommendation:
      aiAnalytics.recommendation,

    /*
     * Existing trend calculation
     */
    trend:
      existingAnalytics.trend
  };


  const finalError =
    validateFinalReading(
      reading
    );

  if (finalError) {
    throw new Error(
      finalError
    );
  }


  /*
   * Save the AI-enhanced reading
   * to MySQL.
   */
  await saveReading(
    reading
  );


  /*
   * Send the same AI-enhanced
   * reading to the frontend.
   */
  emitSensorUpdate(
    reading
  );


  return reading;
}


function startMqttClient() {

  client = mqtt.connect(
    env.mqtt_broker_url,
    {
      reconnectPeriod: 3000,
      connectTimeout: 10000
    }
  );


  client.on(
    'connect',
    () => {

      mqtt_connected = true;

      client.subscribe(
        env.mqtt_topic,
        (error) => {

          if (error) {

            console.error(
              'MQTT subscription failed:',
              error.message
            );

          } else {

            console.log(
              `MQTT subscribed: ${env.mqtt_topic}`
            );

          }
        }
      );
    }
  );


  client.on(
    'reconnect',
    () => {

      mqtt_connected = false;

      console.log(
        'MQTT reconnecting'
      );
    }
  );


  client.on(
    'close',
    () => {

      mqtt_connected = false;

    }
  );


  client.on(
    'error',
    (error) => {

      console.error(
        'MQTT error:',
        error.message
      );

    }
  );


  client.on(
    'message',
    async (
      topic,
      message
    ) => {

      if (
        topic !== env.mqtt_topic
      ) {
        return;
      }


      try {

        const reading =
          await processPayload(
            message
          );

        console.log(
          'AI-enhanced reading saved:',
          {
            machine_id:
              reading.machine_id,

            health_score:
              reading.health_score,

            risk_level:
              reading.risk_level,

            probable_fault:
              reading.probable_fault,

            anomaly:
              reading.anomaly
          }
        );

      } catch (error) {

        console.error(
          'Rejected MQTT message:',
          error.message
        );

      }

    }
  );


  return client;
}


function isMqttConnected() {

  return mqtt_connected;

}


function stopMqttClient() {

  if (client) {
    client.end(true);
  }

}


module.exports = {
  startMqttClient,
  stopMqttClient,
  isMqttConnected,
  processPayload
};