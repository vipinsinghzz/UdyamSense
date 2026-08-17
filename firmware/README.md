# ESP32 firmware: UdyamSense V1

Use `UdyamSenseESP32.ino` with the ESP32, ADXL345, MAX9814, and DS18B20 wiring from the prototype. Before uploading, set `WIFI_SSID` and `WIFI_PASSWORD` locally. Do not put MySQL credentials on the ESP32.

The firmware publishes every two seconds to the frozen MQTT topic `machine/health` at `broker.hivemq.com:1883`. It emits only the raw V1 payload fields: `vibration`, `sound`, `temperature`, and `state`. The backend adds `machine_id` (`M001`), timestamp, analytics, MySQL persistence, and Socket.IO live updates.

Expected Serial Monitor output includes `MQTT connected: machine/health`, followed by `Published: {...}`. Start the Node.js backend before powering the ESP32 and use `/api/sensors/latest/M001` to confirm storage.
