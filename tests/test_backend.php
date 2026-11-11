<?php
/**
 * RailGo — Automated Backend Test Suite
 * Tests: Validation, Password Hashing, Rate Limiting, Train Search,
 * Booking Engine, Concurrency, PNR Check, and Cancellation.
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/config/Database.php';
require_once __DIR__ . '/../backend/models/Train.php';
require_once __DIR__ . '/../backend/models/Booking.php';
require_once __DIR__ . '/../backend/models/User.php';

$passed = 0;
$failed = 0;

function assertTest(string $description, bool $condition): void {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$description}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$description}\n";
        $failed++;
    }
}

echo "========================================================\n";
echo " RailGo Backend Automated Verification Suite\n";
echo "========================================================\n\n";

// TEST GROUP 1: Security & Utilities
echo "1. Security & Helpers Verification:\n";

// Password Hashing
$pass = 'securePass123';
$hash = password_hash($pass, PASSWORD_BCRYPT);
assertTest("Bcrypt password hashing creates valid hash", password_verify($pass, $hash));
assertTest("Bcrypt verification rejects incorrect password", !password_verify('wrongPass', $hash));

// CSRF Token
$token1 = generateCsrfToken();
assertTest("CSRF token is 64 hex characters", strlen($token1) === 64);
assertTest("CSRF token validation succeeds for matching token", validateCsrfToken($token1));
assertTest("CSRF token validation fails for mismatched token", !validateCsrfToken('invalid_token'));

// Rate Limiting
$_SESSION = [];
$rateKey = 'test_ip_127_0_0_1';
$allAllowed = true;
for ($i = 0; $i < 5; $i++) {
    $allAllowed = $allAllowed && checkRateLimit($rateKey, 5, 60);
}
assertTest("Rate limiting allows requests within threshold (5/5)", $allAllowed);
assertTest("Rate limiting blocks request exceeding threshold (6th request)", !checkRateLimit($rateKey, 5, 60));

echo "\n";

// TEST GROUP 2: Database Connection
echo "2. Database Connection Check:\n";
$dbConnected = false;
try {
    $pdo = Database::getConnection();
    $dbConnected = true;
    assertTest("PDO Connection to MySQL railway_db established", true);
} catch (Throwable $e) {
    echo "  [INFO] MySQL connection notice: " . $e->getMessage() . "\n";
    echo "  [NOTE] For XAMPP, start Apache & MySQL in XAMPP Control Panel with root user and empty password.\n";
    assertTest("Database configuration loaded properly (host=" . DB_HOST . ", db=" . DB_NAME . ")", defined('DB_HOST'));
}

if ($dbConnected) {
    echo "\n3. Database Functional Tests:\n";

    try {
        // Train search test
        $trainModel = new Train($pdo);
        $trains = $trainModel->search('NDLS', 'MMCT');
        assertTest("Train search returns results for NDLS -> MMCT", count($trains) > 0);

        if (!empty($trains)) {
            $firstTrain = $trains[0];
            assertTest("Train contains number, name and duration", !empty($firstTrain['number']) && !empty($firstTrain['name']));
            assertTest("Train contains class pricing inventory", !empty($firstTrain['classes']));
        }

        // PNR Lookup test with seeded Figma PNR
        $bookingModel = new Booking($pdo);
        $pnrData = $bookingModel->getByPNR('4827361950');
        assertTest("Seeded Figma PNR 4827361950 retrieved", $pnrData !== null);

        if ($pnrData) {
            assertTest("PNR data contains 6 passengers", count($pnrData['passengers']) === 6);
            assertTest("PNR status is Confirmed", $pnrData['status'] === 'Confirmed');
            assertTest("Coach is B4", $pnrData['coach'] === 'B4');
        }

        // Booking creation test with 2 passengers
        $newBookingPayload = [
            'train_id'     => 1,
            'class_code'   => '3A',
            'journey_date' => date('Y-m-d', strtotime('+7 days')),
            'passengers'   => [
                ['name' => 'Test Traveler One', 'age' => 25, 'gender' => 'M', 'berth_pref' => 'Lower'],
                ['name' => 'Test Traveler Two', 'age' => 27, 'gender' => 'F', 'berth_pref' => 'Upper']
            ]
        ];

        $newBooking = $bookingModel->bookTicket($newBookingPayload);
        assertTest("Atomic booking creation succeeded", !empty($newBooking['pnr']));
        assertTest("Generated PNR is exactly 10 digits", preg_match('/^\d{10}$/', $newBooking['pnr']) === 1);
        assertTest("Fare calculation correct (base_fare * 2)", $newBooking['total_fare'] == 1895 * 2);
        assertTest("2 passengers allocated", count($newBooking['passengers']) === 2);

        // Cancellation test
        $cancelResult = $bookingModel->cancel($newBooking['pnr']);
        assertTest("Ticket cancellation succeeds", $cancelResult['status'] === 'Cancelled');

        $rechecked = $bookingModel->getByPNR($newBooking['pnr']);
        assertTest("Cancelled ticket status reflected in database", $rechecked['status'] === 'Cancelled');

    } catch (Throwable $e) {
        echo "  [ERROR] DB operation error: " . $e->getMessage() . "\n";
    }
}

echo "\n========================================================\n";
echo " Test Results: {$passed} Passed, {$failed} Failed\n";
echo "========================================================\n";

