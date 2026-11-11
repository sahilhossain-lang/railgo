<?php
/**
 * RailGo — Direct PHP Importer for JSON Datasets
 * Connects via PDO, creates railway_db, creates tables, and batch-inserts
 * stations (8,990), trains (5,208), schedules (417,080).
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';

// Allow unlimited execution time and memory for 82MB JSON
ini_set('max_execution_time', '600');
ini_set('memory_limit', '1024M');

echo "=== RailGo Direct MySQL Dataset Importer ===\n";

// 1. Connect to MySQL Server (without selecting DB first)
try {
    $dsn = sprintf('mysql:host=%s;port=%s;charset=%s', DB_HOST, DB_PORT, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET
    ]);
    echo "✓ Connected to MySQL server at " . DB_HOST . ":" . DB_PORT . "\n";
} catch (PDOException $e) {
    echo "✗ Connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 2. Create Database & Tables
echo "Creating database & tables...\n";
$pdo->exec("CREATE DATABASE IF NOT EXISTS `railway_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `railway_db`");
$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

$pdo->exec("DROP TABLE IF EXISTS `passengers`");
$pdo->exec("DROP TABLE IF EXISTS `bookings`");
$pdo->exec("DROP TABLE IF EXISTS `schedules`");
$pdo->exec("DROP TABLE IF EXISTS `trains`");
$pdo->exec("DROP TABLE IF EXISTS `stations`");

$pdo->exec("
CREATE TABLE `stations` (
  `code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `zone` VARCHAR(20) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `latitude` DECIMAL(10, 7) DEFAULT NULL,
  `longitude` DECIMAL(10, 7) DEFAULT NULL,
  PRIMARY KEY (`code`),
  INDEX `idx_stations_name` (`name`),
  INDEX `idx_stations_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("
CREATE TABLE `trains` (
  `number` VARCHAR(10) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `from_station_code` VARCHAR(10) NOT NULL,
  `from_station_name` VARCHAR(150) NOT NULL,
  `to_station_code` VARCHAR(10) NOT NULL,
  `to_station_name` VARCHAR(150) NOT NULL,
  `departure` TIME NOT NULL,
  `arrival` TIME NOT NULL,
  `duration_h` INT NOT NULL DEFAULT 0,
  `duration_m` INT NOT NULL DEFAULT 0,
  `distance` INT NOT NULL DEFAULT 0,
  `zone` VARCHAR(20) DEFAULT NULL,
  `return_train` VARCHAR(10) DEFAULT NULL,
  `first_ac` TINYINT(1) NOT NULL DEFAULT 0,
  `second_ac` TINYINT(1) NOT NULL DEFAULT 0,
  `third_ac` TINYINT(1) NOT NULL DEFAULT 0,
  `chair_car` TINYINT(1) NOT NULL DEFAULT 0,
  `first_class` TINYINT(1) NOT NULL DEFAULT 0,
  `sleeper` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`number`),
  INDEX `idx_trains_route` (`from_station_code`, `to_station_code`),
  INDEX `idx_trains_name` (`name`),
  INDEX `idx_trains_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("
CREATE TABLE `schedules` (
  `id` INT UNSIGNED NOT NULL,
  `train_number` VARCHAR(10) NOT NULL,
  `station_code` VARCHAR(10) NOT NULL,
  `station_name` VARCHAR(150) NOT NULL,
  `arrival` VARCHAR(20) DEFAULT NULL,
  `departure` VARCHAR(20) DEFAULT NULL,
  `day` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_sched_train` (`train_number`),
  INDEX `idx_sched_station` (`station_code`),
  INDEX `idx_sched_train_station` (`train_number`, `station_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("
CREATE TABLE `bookings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `pnr` CHAR(10) NOT NULL,
  `train_number` VARCHAR(10) NOT NULL,
  `train_name` VARCHAR(150) NOT NULL,
  `from_code` VARCHAR(10) NOT NULL,
  `from_name` VARCHAR(150) NOT NULL,
  `to_code` VARCHAR(10) NOT NULL,
  `to_name` VARCHAR(150) NOT NULL,
  `class_code` VARCHAR(10) NOT NULL,
  `journey_date` DATE NOT NULL,
  `departure_time` VARCHAR(20) NOT NULL,
  `arrival_time` VARCHAR(20) NOT NULL,
  `duration` VARCHAR(30) NOT NULL,
  `total_fare` DECIMAL(10, 2) NOT NULL,
  `booking_status` ENUM('Confirmed', 'RAC', 'Waitlist', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  `coach` VARCHAR(10) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_bookings_pnr` (`pnr`),
  INDEX `idx_bookings_train` (`train_number`),
  INDEX `idx_bookings_date` (`journey_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("
CREATE TABLE `passengers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `booking_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `age` TINYINT UNSIGNED NOT NULL,
  `gender` ENUM('M', 'F', 'O') NOT NULL,
  `berth_pref` VARCHAR(30) NOT NULL DEFAULT 'No Preference',
  `assigned_coach` VARCHAR(10) NOT NULL,
  `assigned_seat` INT UNSIGNED NOT NULL,
  `assigned_berth` VARCHAR(30) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Confirmed',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_passengers_booking` (`booking_id`),
  CONSTRAINT `fk_passengers_booking` FOREIGN KEY (`booking_id`)
    REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
echo "✓ Schema tables created successfully!\n";

// 3. Batch Insert Stations
echo "Importing stations.json (699 West Bengal stations)... ";
$stationsJson = json_decode(file_get_contents(__DIR__ . '/stations.json'), true);
$stStmt = $pdo->prepare("INSERT INTO `stations` (code, name, state, zone, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)");

$pdo->beginTransaction();
foreach ($stationsJson['features'] as $f) {
    $p = $f['properties'] ?? [];
    $c = $f['geometry']['coordinates'] ?? [null, null];
    $stStmt->execute([
        $p['code'] ?? null,
        $p['name'] ?? '',
        $p['state'] ?? 'West Bengal',
        $p['zone'] ?? null,
        $p['address'] ?? null,
        $c[1] ?? null,
        $c[0] ?? null
    ]);
}
$pdo->commit();
echo "Done!\n";

// 4. Batch Insert Trains
echo "Importing trains.json (830 West Bengal trains)... ";
$trainsJson = json_decode(file_get_contents(__DIR__ . '/trains.json'), true);
$trStmt = $pdo->prepare("INSERT INTO `trains` (number, name, type, from_station_code, from_station_name, to_station_code, to_station_name, departure, arrival, duration_h, duration_m, distance, zone, return_train, first_ac, second_ac, third_ac, chair_car, first_class, sleeper) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

$pdo->beginTransaction();
foreach ($trainsJson['features'] as $f) {
    $p = $f['properties'] ?? [];
    $trStmt->execute([
        $p['number'] ?? '',
        $p['name'] ?? '',
        $p['type'] ?? '',
        $p['from_station_code'] ?? '',
        $p['from_station_name'] ?? '',
        $p['to_station_code'] ?? '',
        $p['to_station_name'] ?? '',
        $p['departure'] ?? '00:00:00',
        $p['arrival'] ?? '00:00:00',
        (int)($p['duration_h'] ?? 0),
        (int)($p['duration_m'] ?? 0),
        (int)($p['distance'] ?? 0),
        $p['zone'] ?? null,
        $p['return_train'] ?? null,
        (int)($p['first_ac'] ?? 0),
        (int)($p['second_ac'] ?? 0),
        (int)($p['third_ac'] ?? 0),
        (int)($p['chair_car'] ?? 0),
        (int)($p['first_class'] ?? 0),
        (int)($p['sleeper'] ?? 0)
    ]);
}
$pdo->commit();
echo "Done!\n";

// 5. Batch Insert Schedules (33,134)
echo "Importing schedules.json (33,134 West Bengal schedules)... ";
$schedulesJson = json_decode(file_get_contents(__DIR__ . '/schedules.json'), true);
$scStmt = $pdo->prepare("INSERT INTO `schedules` (id, train_number, station_code, station_name, arrival, departure, day) VALUES (?, ?, ?, ?, ?, ?, ?)");

$pdo->beginTransaction();
$count = 0;
foreach ($schedulesJson as $s) {
    $scStmt->execute([
        (int)$s['id'],
        $s['train_number'] ?? '',
        $s['station_code'] ?? '',
        $s['station_name'] ?? '',
        ($s['arrival'] === 'None') ? null : $s['arrival'],
        ($s['departure'] === 'None') ? null : $s['departure'],
        (int)($s['day'] ?? 1)
    ]);
    $count++;
    if ($count % 5000 === 0) {
        $pdo->commit();
        $pdo->beginTransaction();
    }
}
$pdo->commit();
echo "Done!\n";

echo "✓ ALL DATASETS IMPORTED SUCCESSFULLY!\n";
echo "✓ Bookings and Passengers tables are 100% empty and ready for real reservations.\n";

