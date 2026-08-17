# UdyamSense backend (frozen V1)

This is the Node.js backend for the UdyamSense V1 pipeline. The data contract is frozen: contract keys are snake_case and must not be renamed in firmware, MySQL, REST, Socket.IO, the web dashboard, or Android.

```text
ESP32 -> MQTT (machine/health) -> validation -> machine_id + timestamp
      -> analytics -> MySQL historical storage
                     -> Socket.IO sensor:update -> web dashboard
```

## V1 data contract

Raw MQTT payload (the ESP32 must publish these exact fields):

```json
{"vibration":2.43,"sound":147,"temperature":38.2,"state":"WARNING_VIBRATION"}
```

The backend emits and returns this complete structure:

```json
{"machine_id":"M001","timestamp":"2026-08-16T15:45:20+05:30","vibration":2.43,"sound":147,"temperature":38.2,"state":"WARNING_VIBRATION","health_score":72,"risk_level":"MEDIUM","trend":"STABLE","anomaly":true,"probable_fault":"EXCESSIVE_VIBRATION","recommendation":"Inspect motor and rotating components."}
```

Allowed `state`: `NORMAL`, `WARNING_VIBRATION`, `WARNING_SOUND`, `WARNING_TEMP`, `CRITICAL_VIB_SOUND`, `CRITICAL_VIB_TEMP`, `CRITICAL_SOUND_TEMP`, `CRITICAL_ALL`.

Allowed `risk_level`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Allowed `trend`: `RISING`, `FALLING`, `STABLE` (RISING means health is improving). Allowed `probable_fault`: `NONE`, `MECHANICAL_ABNORMALITY`, `OVERHEATING`, `EXCESSIVE_VIBRATION`, `LOOSE_COMPONENT`, `UNKNOWN`.

## Setup

1. Install Node.js 20+ and MySQL 8+.
2. Copy `.env.example` to `.env`, then set the MySQL credentials. `.env` is ignored by Git.
3. Create the schema and default `M001` prototype machine:

```powershell
npm install
npm run db:init
npm start
```

The broker is `mqtt://broker.hivemq.com:1883`, and the only subscribed topic is `machine/health`. The included Vite dashboard runs at `http://localhost:5173`; change `FRONTEND_URL` only if the website uses another port.

## Database

`machines` has `id`, `machine_name`, `machine_code`, `location`, `created_at`, `updated_at`; `machine_code` is unique. The machine APIs return that identity as `machine_id` (not a duplicate alias). `sensor_readings.machine_id` is a foreign key to `machines.machine_code`, so the externally visible `machine_id` stays `M001` while retaining a relational design. Indexed historical queries use `machine_id`, `timestamp`, and `(machine_id, timestamp)`.

## API

All success responses are `{ "success": true, "data": ... }`; errors are `{ "success": false, "error": "..." }`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/status` | backend, database, MQTT connection state and `data_contract_version: "V1"` |
| `GET /api/machines` | list machines |
| `GET /api/machines/:machine_id` | one machine, e.g. `M001` |
| `GET /api/sensors/latest/:machine_id` | latest complete V1 reading |
| `GET /api/sensors/history/:machine_id?hours=24&limit=1000` | chronological complete V1 readings; hours 1–720, limit 1–5000 |

## Socket.IO dashboard integration

Install `socket.io-client` in the frontend, fetch the latest data once, then listen for live readings. Do not poll MySQL every second and do not connect the browser directly to MQTT.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');
socket.on('sensor:update', (reading) => {
  // reading keys are machine_id, timestamp, vibration, sound, temperature,
  // state, health_score, risk_level, trend, anomaly, probable_fault, recommendation
  updateDashboard(reading);
});
```

`sensor:update` always has the full V1 data structure. `machine:subscribe` is available for future room use, but every dashboard connection receives live V1 updates currently.

## Included web dashboard

The React/Vite dashboard is in `frontend/`. It is integrated with this backend: it fetches `/api/machines`, `/api/sensors/latest/:machine_id`, and `/api/sensors/history/:machine_id` for initial data, then receives live `sensor:update` events through Socket.IO. It does **not** connect directly to MQTT.

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Its Vite server runs at `http://localhost:5173`; set `FRONTEND_URL=http://localhost:5173` in the root backend `.env` before starting the backend. Keep the two terminals open: run `npm start` at the repository root for the backend and `npm run dev` inside `frontend/` for the dashboard.

## ESP32 firmware

A ready-to-upload V1 sketch is in `firmware/UdyamSenseESP32.ino`. It publishes the frozen raw payload to `machine/health`; it does not contain or need MySQL credentials. See `firmware/README.md` before setting the local Wi-Fi values and uploading it.

## Analytics V1

Analytics is intentionally transparent and server-side, not machine learning. State penalties create the 0–100 health score: NORMAL 100; warning states 70–72; critical pairs 45–50; CRITICAL_ALL 20. V1 boundaries are fixed: 80–100 LOW, 60–79 MEDIUM, 40–59 HIGH, 0–39 CRITICAL. Trend compares the current score with the immediately prior score: more than +3 is RISING (health improving), below -3 is FALLING, otherwise STABLE.

## Verification and troubleshooting

Run contract tests with `npm test`; they cover every allowed V1 state plus invalid input and risk boundaries. Start MySQL before the service. `/api/status` reports connection states. Malformed MQTT JSON, missing fields, invalid enum values, unknown machines, database query errors, disconnects, and reconnects are handled without allowing a bad MQTT message to terminate the backend.

To publish a manual test payload after the service is running:

```powershell
mosquitto_pub -h broker.hivemq.com -t machine/health -m '{"vibration":2.43,"sound":147,"temperature":38.2,"state":"WARNING_VIBRATION"}'
```

Then request `http://localhost:5000/api/sensors/latest/M001`. This verifies MQTT receipt, V1 validation, server-side `machine_id` and timestamp, analytics, MySQL insert, and the Socket.IO emission path.
