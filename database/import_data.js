/**
 * RailGo — Automated JSON Datasets Importer & SQL Generator
 * Reads stations.json, trains.json, schedules.json and creates clean,
 * production-ready batch SQL with proper escaping, indexes, and tables.
 */

const fs = require('fs');
const path = require('path');

function escapeSql(val) {
  if (val === null || val === undefined || val === 'None' || val === '') {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 'NULL' : String(val);
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\x00/g, '\\0');
  return `'${str}'`;
}

console.log('--- Generating RailGo Full Schema & Data SQL ---');

const sqlHeader = `-- ============================================================================
-- RailGo — Complete Railway Reservation System Database & Datasets
-- Database: railway_db
-- Auto-generated from stations.json (8,990), trains.json (5,208), schedules.json (417,080)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS \`railway_db\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE \`railway_db\`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET AUTOCOMMIT = 0;
START TRANSACTION;

DROP TABLE IF EXISTS \`passengers\`;
DROP TABLE IF EXISTS \`bookings\`;
DROP TABLE IF EXISTS \`schedules\`;
DROP TABLE IF EXISTS \`trains\`;
DROP TABLE IF EXISTS \`stations\`;

-- ----------------------------------------------------------------------------
-- 1. STATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE \`stations\` (
  \`code\` VARCHAR(10) NOT NULL,
  \`name\` VARCHAR(150) NOT NULL,
  \`state\` VARCHAR(100) DEFAULT NULL,
  \`zone\` VARCHAR(20) DEFAULT NULL,
  \`address\` TEXT DEFAULT NULL,
  \`latitude\` DECIMAL(10, 7) DEFAULT NULL,
  \`longitude\` DECIMAL(10, 7) DEFAULT NULL,
  PRIMARY KEY (\`code\`),
  INDEX \`idx_stations_name\` (\`name\`),
  INDEX \`idx_stations_state\` (\`state\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TRAINS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE \`trains\` (
  \`number\` VARCHAR(10) NOT NULL,
  \`name\` VARCHAR(150) NOT NULL,
  \`type\` VARCHAR(50) NOT NULL,
  \`from_station_code\` VARCHAR(10) NOT NULL,
  \`from_station_name\` VARCHAR(150) NOT NULL,
  \`to_station_code\` VARCHAR(10) NOT NULL,
  \`to_station_name\` VARCHAR(150) NOT NULL,
  \`departure\` TIME NOT NULL,
  \`arrival\` TIME NOT NULL,
  \`duration_h\` INT NOT NULL DEFAULT 0,
  \`duration_m\` INT NOT NULL DEFAULT 0,
  \`distance\` INT NOT NULL DEFAULT 0,
  \`zone\` VARCHAR(20) DEFAULT NULL,
  \`return_train\` VARCHAR(10) DEFAULT NULL,
  \`first_ac\` TINYINT(1) NOT NULL DEFAULT 0,
  \`second_ac\` TINYINT(1) NOT NULL DEFAULT 0,
  \`third_ac\` TINYINT(1) NOT NULL DEFAULT 0,
  \`chair_car\` TINYINT(1) NOT NULL DEFAULT 0,
  \`first_class\` TINYINT(1) NOT NULL DEFAULT 0,
  \`sleeper\` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`number\`),
  INDEX \`idx_trains_route\` (\`from_station_code\`, \`to_station_code\`),
  INDEX \`idx_trains_name\` (\`name\`),
  INDEX \`idx_trains_type\` (\`type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. SCHEDULES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE \`schedules\` (
  \`id\` INT UNSIGNED NOT NULL,
  \`train_number\` VARCHAR(10) NOT NULL,
  \`station_code\` VARCHAR(10) NOT NULL,
  \`station_name\` VARCHAR(150) NOT NULL,
  \`arrival\` VARCHAR(20) DEFAULT NULL,
  \`departure\` VARCHAR(20) DEFAULT NULL,
  \`day\` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  INDEX \`idx_sched_train\` (\`train_number\`),
  INDEX \`idx_sched_station\` (\`station_code\`),
  INDEX \`idx_sched_train_station\` (\`train_number\`, \`station_code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. BOOKINGS TABLE (100% EMPTY FOR REAL WEBSITE BOOKINGS)
-- ----------------------------------------------------------------------------
CREATE TABLE \`bookings\` (
  \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  \`pnr\` CHAR(10) NOT NULL,
  \`train_number\` VARCHAR(10) NOT NULL,
  \`train_name\` VARCHAR(150) NOT NULL,
  \`from_code\` VARCHAR(10) NOT NULL,
  \`from_name\` VARCHAR(150) NOT NULL,
  \`to_code\` VARCHAR(10) NOT NULL,
  \`to_name\` VARCHAR(150) NOT NULL,
  \`class_code\` VARCHAR(10) NOT NULL,
  \`journey_date\` DATE NOT NULL,
  \`departure_time\` VARCHAR(20) NOT NULL,
  \`arrival_time\` VARCHAR(20) NOT NULL,
  \`duration\` VARCHAR(30) NOT NULL,
  \`total_fare\` DECIMAL(10, 2) NOT NULL,
  \`booking_status\` ENUM('Confirmed', 'RAC', 'Waitlist', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  \`coach\` VARCHAR(10) NOT NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`idx_bookings_pnr\` (\`pnr\`),
  INDEX \`idx_bookings_train\` (\`train_number\`),
  INDEX \`idx_bookings_date\` (\`journey_date\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. PASSENGERS TABLE (100% EMPTY FOR REAL WEBSITE BOOKINGS)
-- ----------------------------------------------------------------------------
CREATE TABLE \`passengers\` (
  \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  \`booking_id\` INT UNSIGNED NOT NULL,
  \`name\` VARCHAR(100) NOT NULL,
  \`age\` TINYINT UNSIGNED NOT NULL,
  \`gender\` ENUM('M', 'F', 'O') NOT NULL,
  \`berth_pref\` VARCHAR(30) NOT NULL DEFAULT 'No Preference',
  \`assigned_coach\` VARCHAR(10) NOT NULL,
  \`assigned_seat\` INT UNSIGNED NOT NULL,
  \`assigned_berth\` VARCHAR(30) NOT NULL,
  \`status\` VARCHAR(30) NOT NULL DEFAULT 'Confirmed',
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_passengers_booking\` (\`booking_id\`),
  CONSTRAINT \`fk_passengers_booking\` FOREIGN KEY (\`booking_id\`)
    REFERENCES \`bookings\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

const outFile = path.join(__dirname, 'schema.sql');
const writeStream = fs.createWriteStream(outFile, { encoding: 'utf8' });
writeStream.write(sqlHeader);

// 1. Process Stations
console.log('1. Parsing stations.json (8,990 records)...');
const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf8')).features;
writeStream.write(`-- ----------------------------------------------------------------------------\n-- INSERTS: STATIONS (${stationsData.length} records)\n-- ----------------------------------------------------------------------------\n`);

const BATCH_SIZE = 500;
for (let i = 0; i < stationsData.length; i += BATCH_SIZE) {
  const batch = stationsData.slice(i, i + BATCH_SIZE);
  const rows = batch.map(f => {
    const p = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [null, null];
    return `(${escapeSql(p.code)}, ${escapeSql(p.name)}, ${escapeSql(p.state)}, ${escapeSql(p.zone)}, ${escapeSql(p.address)}, ${escapeSql(coords[1])}, ${escapeSql(coords[0])})`;
  });
  writeStream.write(`INSERT INTO \`stations\` (\`code\`, \`name\`, \`state\`, \`zone\`, \`address\`, \`latitude\`, \`longitude\`) VALUES\n${rows.join(',\n')};\n`);
}

// 2. Process Trains
console.log('2. Parsing trains.json (5,208 records)...');
const trainsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'trains.json'), 'utf8')).features;
writeStream.write(`\n-- ----------------------------------------------------------------------------\n-- INSERTS: TRAINS (${trainsData.length} records)\n-- ----------------------------------------------------------------------------\n`);

for (let i = 0; i < trainsData.length; i += BATCH_SIZE) {
  const batch = trainsData.slice(i, i + BATCH_SIZE);
  const rows = batch.map(f => {
    const p = f.properties || {};
    return `(${escapeSql(p.number)}, ${escapeSql(p.name)}, ${escapeSql(p.type)}, ${escapeSql(p.from_station_code)}, ${escapeSql(p.from_station_name)}, ${escapeSql(p.to_station_code)}, ${escapeSql(p.to_station_name)}, ${escapeSql(p.departure)}, ${escapeSql(p.arrival)}, ${escapeSql(p.duration_h)}, ${escapeSql(p.duration_m)}, ${escapeSql(p.distance)}, ${escapeSql(p.zone)}, ${escapeSql(p.return_train)}, ${escapeSql(p.first_ac)}, ${escapeSql(p.second_ac)}, ${escapeSql(p.third_ac)}, ${escapeSql(p.chair_car)}, ${escapeSql(p.first_class)}, ${escapeSql(p.sleeper)})`;
  });
  writeStream.write(`INSERT INTO \`trains\` (\`number\`, \`name\`, \`type\`, \`from_station_code\`, \`from_station_name\`, \`to_station_code\`, \`to_station_name\`, \`departure\`, \`arrival\`, \`duration_h\`, \`duration_m\`, \`distance\`, \`zone\`, \`return_train\`, \`first_ac\`, \`second_ac\`, \`third_ac\`, \`chair_car\`, \`first_class\`, \`sleeper\`) VALUES\n${rows.join(',\n')};\n`);
}

// 3. Process Schedules
console.log('3. Parsing schedules.json (417,080 records)...');
const schedulesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'schedules.json'), 'utf8'));
writeStream.write(`\n-- ----------------------------------------------------------------------------\n-- INSERTS: SCHEDULES (${schedulesData.length} records)\n-- ----------------------------------------------------------------------------\n`);

const SCHED_BATCH = 1000;
for (let i = 0; i < schedulesData.length; i += SCHED_BATCH) {
  const batch = schedulesData.slice(i, i + SCHED_BATCH);
  const rows = batch.map(s => {
    return `(${escapeSql(s.id)}, ${escapeSql(s.train_number)}, ${escapeSql(s.station_code)}, ${escapeSql(s.station_name)}, ${escapeSql(s.arrival)}, ${escapeSql(s.departure)}, ${escapeSql(s.day)})`;
  });
  writeStream.write(`INSERT INTO \`schedules\` (\`id\`, \`train_number\`, \`station_code\`, \`station_name\`, \`arrival\`, \`departure\`, \`day\`) VALUES\n${rows.join(',\n')};\n`);
}

writeStream.write(`\nCOMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\n-- Completed successfully.\n`);
writeStream.end(() => {
  const stats = fs.statSync(outFile);
  console.log(`✓ database/schema.sql created successfully! File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
});

