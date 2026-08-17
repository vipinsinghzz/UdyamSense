CREATE DATABASE IF NOT EXISTS udyamsense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE udyamsense;

CREATE TABLE IF NOT EXISTS machines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  machine_name VARCHAR(150) NOT NULL,
  machine_code VARCHAR(50) NOT NULL,
  location VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_machines_machine_code (machine_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  machine_id VARCHAR(50) NOT NULL,
  timestamp DATETIME NOT NULL,
  vibration DECIMAL(10,3) NOT NULL,
  sound DECIMAL(10,3) NOT NULL,
  temperature DECIMAL(10,3) NOT NULL,
  state VARCHAR(32) NOT NULL,
  health_score DECIMAL(5,2) NOT NULL,
  risk_level VARCHAR(16) NOT NULL,
  trend VARCHAR(16) NOT NULL,
  anomaly BOOLEAN NOT NULL,
  probable_fault VARCHAR(32) NOT NULL,
  recommendation TEXT NOT NULL,
  CONSTRAINT fk_sensor_readings_machine_id FOREIGN KEY (machine_id) REFERENCES machines(machine_code),
  CONSTRAINT chk_health_score CHECK (health_score BETWEEN 0 AND 100),
  CONSTRAINT chk_state CHECK (state IN ('NORMAL','WARNING_VIBRATION','WARNING_SOUND','WARNING_TEMP','CRITICAL_VIB_SOUND','CRITICAL_VIB_TEMP','CRITICAL_SOUND_TEMP','CRITICAL_ALL')),
  CONSTRAINT chk_risk_level CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT chk_trend CHECK (trend IN ('RISING','FALLING','STABLE')),
  CONSTRAINT chk_probable_fault CHECK (probable_fault IN ('NONE','MECHANICAL_ABNORMALITY','OVERHEATING','EXCESSIVE_VIBRATION','LOOSE_COMPONENT','UNKNOWN')),
  KEY idx_sensor_readings_machine_id (machine_id),
  KEY idx_sensor_readings_timestamp (timestamp),
  KEY idx_sensor_readings_machine_timestamp (machine_id, timestamp)
) ENGINE=InnoDB;
