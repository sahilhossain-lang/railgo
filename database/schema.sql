-- ============================================================================
-- RailGo — Railway Reservation System Database Schema
-- Database Name: railway_db
-- Target: MySQL 8.0+ / MariaDB 10.4+ (XAMPP / Standalone)
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `railway_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `railway_db`;

-- Disable foreign key checks during schema creation / drop
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `passengers`;
DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `train_seats`;
DROP TABLE IF EXISTS `trains`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores registered passengers, authentication credentials and roles
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TRAINS TABLE
-- Master catalog of trains, routes, schedules, types and categories
-- ----------------------------------------------------------------------------
CREATE TABLE `trains` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `train_number` VARCHAR(10) NOT NULL,
  `train_name` VARCHAR(120) NOT NULL,
  `train_type` VARCHAR(50) NOT NULL, -- Rajdhani, Vande Bharat, Express, Superfast, Shatabdi
  `category_tag` VARCHAR(100) NOT NULL, -- e.g. "RAJDHANI · RUNS DAILY"
  `hint` VARCHAR(150) DEFAULT NULL,    -- e.g. "Fastest overnight"
  `from_code` VARCHAR(10) NOT NULL,    -- e.g. NDLS
  `from_name` VARCHAR(100) NOT NULL,   -- e.g. New Delhi
  `to_code` VARCHAR(10) NOT NULL,      -- e.g. MMCT
  `to_name` VARCHAR(100) NOT NULL,     -- e.g. Mumbai Central
  `departure_time` TIME NOT NULL,      -- e.g. 16:55:00
  `arrival_time` TIME NOT NULL,        -- e.g. 08:35:00
  `duration` VARCHAR(20) NOT NULL,     -- e.g. "15h 40m"
  `departure_slot` ENUM('early_morning', 'morning', 'afternoon', 'evening') NOT NULL,
  `runs_on` VARCHAR(50) NOT NULL DEFAULT 'Daily',
  `next_day` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_trains_number` (`train_number`),
  INDEX `idx_trains_route` (`from_code`, `to_code`),
  INDEX `idx_trains_slot` (`departure_slot`),
  INDEX `idx_trains_type` (`train_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TRAIN_SEATS TABLE
-- Per-class inventory, pricing, live seat availability, RAC and waitlist counters
-- ----------------------------------------------------------------------------
CREATE TABLE `train_seats` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `train_id` INT UNSIGNED NOT NULL,
  `class_code` VARCHAR(10) NOT NULL, -- 1A, 2A, 3A, CC, EC, SL, 2S
  `class_name` VARCHAR(50) NOT NULL, -- e.g. "3A · AC 3 tier"
  `base_fare` DECIMAL(10,2) NOT NULL,
  `total_seats` INT UNSIGNED NOT NULL DEFAULT 60,
  `available_seats` INT UNSIGNED NOT NULL DEFAULT 60,
  `rac_seats` INT UNSIGNED NOT NULL DEFAULT 10,
  `waitlist_seats` INT UNSIGNED NOT NULL DEFAULT 20,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_train_class` (`train_id`, `class_code`),
  CONSTRAINT `fk_seats_train` FOREIGN KEY (`train_id`)
    REFERENCES `trains` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. BOOKINGS TABLE
-- Ticket bookings with unique 10-digit PNR, coach assignment, journey date and fare
-- ----------------------------------------------------------------------------
CREATE TABLE `bookings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `pnr` CHAR(10) NOT NULL,
  `user_id` INT UNSIGNED NULL,
  `train_id` INT UNSIGNED NOT NULL,
  `class_code` VARCHAR(10) NOT NULL,
  `journey_date` DATE NOT NULL,
  `total_fare` DECIMAL(10,2) NOT NULL,
  `booking_status` ENUM('Confirmed', 'RAC', 'Waitlist', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  `coach` VARCHAR(10) NOT NULL, -- e.g. B4, A1, H1, C1, E1, S1
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_bookings_pnr` (`pnr`),
  INDEX `idx_bookings_user` (`user_id`),
  INDEX `idx_bookings_train` (`train_id`),
  INDEX `idx_bookings_date` (`journey_date`),
  CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_train` FOREIGN KEY (`train_id`)
    REFERENCES `trains` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. PASSENGERS TABLE
-- Manifest entries linked to bookings: berth preferences, assigned seats & status
-- ----------------------------------------------------------------------------
CREATE TABLE `passengers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `booking_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `age` TINYINT UNSIGNED NOT NULL,
  `gender` ENUM('M', 'F', 'O') NOT NULL,
  `berth_pref` VARCHAR(30) NOT NULL DEFAULT 'No Preference',
  `assigned_coach` VARCHAR(10) NOT NULL,
  `assigned_seat` INT UNSIGNED NOT NULL,
  `assigned_berth` VARCHAR(30) NOT NULL, -- Lower, Middle, Upper, Side Lower, Side Upper, Window
  `status` VARCHAR(30) NOT NULL DEFAULT 'Confirmed',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_passengers_booking` (`booking_id`),
  CONSTRAINT `fk_passengers_booking` FOREIGN KEY (`booking_id`)
    REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SEED DATA
-- Realistic Indian Railways train routes, inventory and Figma demo records
-- ============================================================================

-- 1. Demo User (Password: password123)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`) VALUES
(1, 'Sahil Hossain', 'sahil@railgo.com', '$2y$10$yoHe8rAd32wUFbno7oF38OHEpFywQmKKjbFBJLAsAjvZ9jHIiDQk6', 'user'),
(2, 'RailGo Admin', 'admin@railgo.com', '$2y$10$yoHe8rAd32wUFbno7oF38OHEpFywQmKKjbFBJLAsAjvZ9jHIiDQk6', 'admin');

-- 2. Trains Master Catalog
INSERT INTO `trains` (`id`, `train_number`, `train_name`, `train_type`, `category_tag`, `hint`, `from_code`, `from_name`, `to_code`, `to_name`, `departure_time`, `arrival_time`, `duration`, `departure_slot`, `runs_on`, `next_day`) VALUES
-- New Delhi -> Mumbai Central
(1, '12952', 'Mumbai Rajdhani', 'Rajdhani', 'RAJDHANI · RUNS DAILY', 'Fastest overnight', 'NDLS', 'New Delhi', 'MMCT', 'Mumbai Central', '16:55:00', '08:35:00', '15h 40m', 'afternoon', 'Daily', 1),
(2, '12954', 'August Kranti Rajdhani', 'Rajdhani', 'RAJDHANI · RUNS DAILY', 'A little more time to unwind', 'NDLS', 'New Delhi', 'MMCT', 'Mumbai Central', '17:15:00', '10:05:00', '16h 50m', 'afternoon', 'Daily', 1),
(3, '12926', 'Paschim Express', 'Express', 'EXPRESS · RUNS DAILY', 'The scenic way south', 'NDLS', 'New Delhi', 'MMCT', 'Mumbai Central', '16:45:00', '14:55:00', '22h 10m', 'afternoon', 'Daily', 1),
(4, '20901', 'Vande Bharat Express', 'Vande Bharat', 'VANDE BHARAT · EXCEPT SUN', 'High-speed comfortable seating', 'NDLS', 'New Delhi', 'MMCT', 'Mumbai Central', '06:00:00', '18:15:00', '12h 15m', 'morning', 'Except Sun', 0),
(5, '12903', 'Golden Temple Mail', 'Superfast', 'SUPERFAST · RUNS DAILY', 'Historic heritage connection', 'NDLS', 'New Delhi', 'MMCT', 'Mumbai Central', '21:25:00', '18:45:00', '21h 20m', 'evening', 'Daily', 1),

-- Mumbai Central -> New Delhi (Return)
(6, '12951', 'New Delhi Rajdhani', 'Rajdhani', 'RAJDHANI · RUNS DAILY', 'Prime capital connection', 'MMCT', 'Mumbai Central', 'NDLS', 'New Delhi', '17:00:00', '08:32:00', '15h 32m', 'afternoon', 'Daily', 1),

-- Bengaluru -> Chennai
(7, '20608', 'Vande Bharat Express', 'Vande Bharat', 'VANDE BHARAT · EXCEPT WED', 'Fastest South corridor', 'SBC', 'KSR Bengaluru', 'MAS', 'MGR Chennai Central', '05:45:00', '10:10:00', '4h 25m', 'early_morning', 'Except Wed', 0),
(8, '12028', 'Shatabdi Express', 'Shatabdi', 'SHATABDI · EXCEPT TUE', 'Classic intercity express', 'SBC', 'KSR Bengaluru', 'MAS', 'MGR Chennai Central', '06:00:00', '11:00:00', '5h 00m', 'morning', 'Except Tue', 0),

-- Goa -> Mumbai
(9, '22229', 'Vande Bharat Express', 'Vande Bharat', 'VANDE BHARAT · EXCEPT FRI', 'Coastal scenic speed', 'MAO', 'Madgaon Goa', 'MMCT', 'Mumbai Central', '14:40:00', '22:25:00', '7h 45m', 'afternoon', 'Except Fri', 0),
(10, '12052', 'Jan Shatabdi Express', 'Superfast', 'SUPERFAST · RUNS DAILY', 'Affordable coastal line', 'MAO', 'Madgaon Goa', 'MMCT', 'Mumbai Central', '12:00:00', '21:30:00', '9h 30m', 'morning', 'Daily', 0),

-- New Delhi -> Howrah (Kolkata)
(11, '12302', 'Howrah Rajdhani', 'Rajdhani', 'RAJDHANI · EXCEPT SUN', 'Eastern flagship', 'NDLS', 'New Delhi', 'HWH', 'Howrah (Kolkata)', '16:50:00', '09:55:00', '17h 05m', 'afternoon', 'Except Sun', 1),
(12, '12304', 'Poorva Express', 'Superfast', 'SUPERFAST · RUNS DAILY', 'Historic Grand Chord route', 'NDLS', 'New Delhi', 'HWH', 'Howrah (Kolkata)', '17:40:00', '17:00:00', '23h 20m', 'afternoon', 'Daily', 1);

-- 3. Train Seats & Pricing Inventory
INSERT INTO `train_seats` (`train_id`, `class_code`, `class_name`, `base_fare`, `total_seats`, `available_seats`, `rac_seats`, `waitlist_seats`) VALUES
-- Train 1: 12952 Mumbai Rajdhani
(1, '3A', '3A · AC 3 tier', 1895.00, 60, 42, 10, 20),
(1, '2A', '2A · AC 2 tier', 2650.00, 40, 12, 6, 15),
(1, '1A', '1A · AC 1st Class', 4550.00, 20, 8, 2, 8),
(1, 'SL', 'Sleeper Class', 650.00, 72, 0, 0, 30),

-- Train 2: 12954 August Kranti Rajdhani
(2, '3A', '3A · AC 3 tier', 1895.00, 60, 36, 8, 20),
(2, '2A', '2A · AC 2 tier', 2650.00, 40, 18, 5, 15),
(2, '1A', '1A · AC 1st Class', 4550.00, 20, 4, 2, 5),
(2, 'SL', 'Sleeper Class', 650.00, 72, 0, 0, 25),

-- Train 3: 12926 Paschim Express
(3, '3A', '3A · AC 3 tier', 1540.00, 64, 75, 12, 25),
(3, '2A', '2A · AC 2 tier', 2210.00, 46, 24, 8, 15),
(3, '1A', '1A · AC 1st Class', 3780.00, 18, 5, 2, 10),
(3, 'SL', 'Sleeper Class', 590.00, 80, 110, 20, 30),
(3, '2S', 'Second Sitting', 340.00, 90, 95, 15, 20),

-- Train 4: 20901 Vande Bharat Express
(4, 'CC', 'AC Chair Car', 2450.00, 78, 58, 10, 25),
(4, 'EC', 'Exec Chair Car', 4100.00, 52, 8, 4, 10),

-- Train 5: 12903 Golden Temple Mail
(5, '3A', '3A · AC 3 tier', 1620.00, 64, 28, 8, 20),
(5, '2A', '2A · AC 2 tier', 2340.00, 46, 6, 4, 15),
(5, 'SL', 'Sleeper Class', 610.00, 80, 45, 12, 25),

-- Train 6: 12951 New Delhi Rajdhani
(6, '3A', '3A · AC 3 tier', 1895.00, 60, 35, 8, 20),
(6, '2A', '2A · AC 2 tier', 2650.00, 40, 15, 6, 15),
(6, '1A', '1A · AC 1st Class', 4550.00, 20, 6, 2, 8),

-- Train 7: 20608 Vande Bharat (SBC -> MAS)
(7, 'CC', 'AC Chair Car', 1050.00, 78, 62, 10, 20),
(7, 'EC', 'Exec Chair Car', 1980.00, 52, 14, 5, 10),

-- Train 8: 12028 Shatabdi Express (SBC -> MAS)
(8, 'CC', 'AC Chair Car', 920.00, 78, 48, 10, 20),
(8, 'EC', 'Exec Chair Car', 1740.00, 52, 11, 4, 10),

-- Train 9: 22229 Vande Bharat (MAO -> MMCT)
(9, 'CC', 'AC Chair Car', 1815.00, 78, 40, 10, 20),
(9, 'EC', 'Exec Chair Car', 3355.00, 52, 12, 4, 10),

-- Train 10: 12052 Jan Shatabdi (MAO -> MMCT)
(10, '2S', 'Second Sitting', 290.00, 90, 80, 15, 20),
(10, 'CC', 'AC Chair Car', 990.00, 78, 22, 6, 15),

-- Train 11: 12302 Howrah Rajdhani (NDLS -> HWH)
(11, '3A', '3A · AC 3 tier', 2150.00, 60, 28, 8, 20),
(11, '2A', '2A · AC 2 tier', 3020.00, 40, 10, 4, 10),
(11, '1A', '1A · AC 1st Class', 5120.00, 20, 4, 2, 5),

-- Train 12: 12304 Poorva Express (NDLS -> HWH)
(12, '3A', '3A · AC 3 tier', 1720.00, 64, 45, 10, 20),
(12, '2A', '2A · AC 2 tier', 2460.00, 46, 16, 6, 15),
(12, 'SL', 'Sleeper Class', 660.00, 80, 55, 15, 25);

-- ----------------------------------------------------------------------------
-- 4. Figma Demo Booking (PNR: 4827361950)
-- Matches Figma design 4:12137 & 4:12139 (Mumbai Rajdhani, 3A, Coach B4, 6 Passengers)
-- ----------------------------------------------------------------------------
INSERT INTO `bookings` (`id`, `pnr`, `user_id`, `train_id`, `class_code`, `journey_date`, `total_fare`, `booking_status`, `coach`, `created_at`) VALUES
(1, '4827361950', 1, 1, '3A', '2026-11-20', 11370.00, 'Confirmed', 'B4', '2026-11-10 12:42:00');

-- 6 Passengers manifest matching Figma
INSERT INTO `passengers` (`booking_id`, `name`, `age`, `gender`, `berth_pref`, `assigned_coach`, `assigned_seat`, `assigned_berth`, `status`) VALUES
(1, 'Aanya Sharma', 28, 'F', 'Lower', 'B4', 21, 'Lower', 'Confirmed'),
(1, 'Rohan Mehta', 29, 'M', 'Upper', 'B4', 22, 'Upper', 'Confirmed'),
(1, 'Meera Iyer', 30, 'F', 'Lower', 'B4', 23, 'Lower', 'Confirmed'),
(1, 'Arjun Rao', 31, 'M', 'Upper', 'B4', 24, 'Upper', 'Confirmed'),
(1, 'Kavya Nair', 32, 'F', 'Lower', 'B4', 25, 'Lower', 'Confirmed'),
(1, 'Dev Patel', 33, 'M', 'Upper', 'B4', 26, 'Upper', 'Confirmed');
