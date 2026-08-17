// #include <WiFi.h>
// #include <PubSubClient.h>
// #include <Wire.h>
// #include <OneWire.h>
// #include <DallasTemperature.h>
// #include <math.h>

// // Copy this file before uploading and set only these Wi-Fi values locally.
// // Never commit real Wi-Fi credentials.
// const char* WIFI_SSID = "YOUR_WIFI_NAME";
// const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// // FROZEN UdyamSense V1 MQTT configuration. Do not change the topic.
// const char* MQTT_BROKER = "broker.hivemq.com";
// const uint16_t MQTT_PORT = 1883;
// const char* MQTT_TOPIC = "machine/health";

// constexpr uint8_t ADXL345_ADDRESS = 0x53;
// constexpr uint8_t ONE_WIRE_BUS = 4;
// constexpr uint8_t MIC_PIN = 34;
// constexpr unsigned long MQTT_INTERVAL_MS = 2000;

// WiFiClient espClient;
// PubSubClient mqttClient(espClient);
// OneWire oneWire(ONE_WIRE_BUS);
// DallasTemperature temperatureSensor(&oneWire);

// int16_t x, y, z;
// float gravityBaseline = 0;
// float machineBaseline = 0;
// float smoothRaw = 0;
// float smoothSound = 0;
// float soundBaseline = 0;

// bool learning = true;
// unsigned long learningStart = 0;
// float learningSum = 0;
// int learningCount = 0;
// unsigned long lastMQTTSend = 0;
// unsigned long lastChangeTime = 0;
// unsigned long lastTriggerTime = 0;
// String lastStatus = "NORMAL";

// constexpr float SOUND_ALPHA = 0.2;
// constexpr float VIBRATION_THRESHOLD = 2.0;
// constexpr float SOUND_OFFSET = 120.0;
// constexpr float TEMPERATURE_THRESHOLD = 35.0;
// constexpr unsigned long LEARNING_DURATION_MS = 10000;
// constexpr unsigned long MIN_HOLD_TIME_MS = 2000;
// constexpr unsigned long COOLDOWN_TIME_MS = 3000;

// void connectWiFi() {
//   if (WiFi.status() == WL_CONNECTED) return;
//   WiFi.mode(WIFI_STA);
//   WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
//   Serial.print("Connecting to Wi-Fi");
//   while (WiFi.status() != WL_CONNECTED) {
//     delay(500);
//     Serial.print(".");
//   }
//   Serial.println(" connected");
// }

// void reconnectMQTT() {
//   static unsigned long lastAttempt = 0;
//   if (mqttClient.connected() || millis() - lastAttempt < 2000) return;
//   lastAttempt = millis();

//   String clientId = "UdyamSense-ESP32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
//   if (mqttClient.connect(clientId.c_str())) {
//     Serial.println("MQTT connected: machine/health");
//   } else {
//     Serial.printf("MQTT connect failed, rc=%d\n", mqttClient.state());
//   }
// }

// // Required raw V1 payload: vibration, sound, temperature, state.
// // machine_id and analytics are deliberately added by the Node.js backend.
// void publishData(float vibration, float sound, float temperature, const String& state) {
//   if (!isfinite(vibration) || !isfinite(sound) || !isfinite(temperature)) {
//     Serial.println("Invalid sensor value; MQTT publish skipped");
//     return;
//   }

//   String payload = "{";
//   payload += "\"vibration\":" + String(vibration, 3) + ",";
//   payload += "\"sound\":" + String(sound, 3) + ",";
//   payload += "\"temperature\":" + String(temperature, 2) + ",";
//   payload += "\"state\":\"" + state + "\"}";

//   if (mqttClient.publish(MQTT_TOPIC, payload.c_str())) {
//     Serial.println("Published: " + payload);
//   } else {
//     Serial.println("MQTT publish failed");
//   }
// }

// float readADXL() {
//   Wire.beginTransmission(ADXL345_ADDRESS);
//   Wire.write(0x32);
//   if (Wire.endTransmission(false) != 0 || Wire.requestFrom(ADXL345_ADDRESS, (uint8_t)6, true) != 6) {
//     return NAN;
//   }
//   x = Wire.read() | (Wire.read() << 8);
//   y = Wire.read() | (Wire.read() << 8);
//   z = Wire.read() | (Wire.read() << 8);
//   return sqrtf((float)x * x + (float)y * y + (float)z * z);
// }

// float getSoundLevel() {
//   constexpr int samples = 50;
//   int total = 0;
//   for (int i = 0; i < samples; i++) {
//     total += analogRead(MIC_PIN);
//     delayMicroseconds(200);
//   }
//   const int average = total / samples;
//   int variance = 0;
//   for (int i = 0; i < samples; i++) {
//     variance += abs(analogRead(MIC_PIN) - average);
//     delayMicroseconds(200);
//   }
//   return (float)variance / samples;
// }

// String determineState(bool vibrationAlert, bool soundAlert, bool temperatureAlert) {
//   if (vibrationAlert && soundAlert && temperatureAlert) return "CRITICAL_ALL";
//   if (vibrationAlert && soundAlert) return "CRITICAL_VIB_SOUND";
//   if (vibrationAlert && temperatureAlert) return "CRITICAL_VIB_TEMP";
//   if (soundAlert && temperatureAlert) return "CRITICAL_SOUND_TEMP";
//   if (vibrationAlert) return "WARNING_VIBRATION";
//   if (soundAlert) return "WARNING_SOUND";
//   if (temperatureAlert) return "WARNING_TEMP";
//   return "NORMAL";
// }

// String applyStabilityFilter(String state) {
//   if (state == lastStatus) return lastStatus;
//   if (millis() - lastChangeTime <= MIN_HOLD_TIME_MS) return lastStatus;
//   if (state != "NORMAL" && millis() - lastTriggerTime < COOLDOWN_TIME_MS) return lastStatus;

//   lastStatus = state;
//   lastChangeTime = millis();
//   if (state != "NORMAL") lastTriggerTime = millis();
//   return lastStatus;
// }

// void setup() {
//   Serial.begin(115200);
//   Wire.begin(21, 22);
//   analogReadResolution(12);
//   connectWiFi();
//   mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
//   mqttClient.setBufferSize(512);

//   Wire.beginTransmission(ADXL345_ADDRESS);
//   Wire.write(0x2D);
//   Wire.write(8);
//   Wire.endTransmission();
//   temperatureSensor.begin();

//   float sum = 0;
//   for (int i = 0; i < 30; i++) {
//     const float reading = readADXL();
//     if (!isfinite(reading)) { Serial.println("ADXL345 not detected"); delay(1000); ESP.restart(); }
//     sum += reading;
//     delay(100);
//   }
//   gravityBaseline = sum / 30;
//   smoothRaw = gravityBaseline;

//   float microphoneSum = 0;
//   for (int i = 0; i < 50; i++) { microphoneSum += getSoundLevel(); delay(20); }
//   soundBaseline = microphoneSum / 50;
//   learningStart = millis();
// }

// void loop() {
//   connectWiFi();
//   reconnectMQTT();
//   mqttClient.loop();

//   const float raw = readADXL();
//   if (!isfinite(raw)) { delay(100); return; }
//   smoothRaw = 0.9 * smoothRaw + 0.1 * raw;
//   const float clean = fabsf(smoothRaw - gravityBaseline);

//   if (learning) {
//     learningSum += clean;
//     learningCount++;
//     if (millis() - learningStart > LEARNING_DURATION_MS) {
//       machineBaseline = learningSum / learningCount;
//       learning = false;
//       Serial.println("Sensor baseline learning complete");
//     }
//     delay(100);
//     return;
//   }

//   const float vibration = fabsf(clean - machineBaseline);
//   const bool vibrationAlert = vibration > VIBRATION_THRESHOLD;
//   const float sound = SOUND_ALPHA * getSoundLevel() + (1 - SOUND_ALPHA) * smoothSound;
//   smoothSound = sound;
//   const bool soundAlert = sound > soundBaseline + SOUND_OFFSET;

//   temperatureSensor.requestTemperatures();
//   const float temperature = temperatureSensor.getTempCByIndex(0);
//   if (temperature == DEVICE_DISCONNECTED_C) { Serial.println("DS18B20 disconnected"); delay(100); return; }
//   const bool temperatureAlert = temperature > TEMPERATURE_THRESHOLD;
//   const String state = applyStabilityFilter(determineState(vibrationAlert, soundAlert, temperatureAlert));

//   if (mqttClient.connected() && millis() - lastMQTTSend >= MQTT_INTERVAL_MS) {
//     publishData(vibration, sound, temperature, state);
//     lastMQTTSend = millis();
//   }
//   delay(50);
// }
