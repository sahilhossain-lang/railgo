<?php
/**
 * RailGo — REST API: Search Trains
 * GET /api/search_trains.php?from=NDLS&to=MMCT&date=2026-11-20&class=3A&type=Rajdhani&time_slot=afternoon
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/Train.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse(false, null, 'Method not allowed. Use GET.', 405);
}

$from = trim($_GET['from'] ?? '');
$to = trim($_GET['to'] ?? '');
$date = trim($_GET['date'] ?? '');
$class = trim($_GET['class'] ?? '');
$type = trim($_GET['type'] ?? '');
$slot = trim($_GET['time_slot'] ?? '');

if (empty($from) || empty($to)) {
    sendJsonResponse(false, null, 'Please provide both origin (from) and destination (to) stations.', 400);
}

try {
    $trainModel = new Train();
    $trains = $trainModel->search($from, $to, $date ?: null, $class ?: null, $type ?: null, $slot ?: null);

    sendJsonResponse(true, $trains, count($trains) . ' trains found.');
} catch (Throwable $e) {
    error_log("Search trains error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to fetch train schedules: ' . $e->getMessage(), 500);
}
