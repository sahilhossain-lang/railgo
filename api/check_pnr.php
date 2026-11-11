<?php
/**
 * RailGo — REST API: Check PNR Status
 * GET /api/check_pnr.php?pnr=4827361950
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/Booking.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse(false, null, 'Method not allowed. Use GET.', 405);
}

// 1. Sliding window rate limiting to prevent brute-force lookups
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
if (!checkRateLimit("pnr_lookup_{$clientIp}", 45, 60)) {
    sendJsonResponse(false, null, 'Rate limit exceeded. Please wait a moment before trying again.', 429);
}

$pnr = trim($_GET['pnr'] ?? '');

if (!preg_match('/^\d{10}$/', $pnr)) {
    sendJsonResponse(false, null, 'Please provide a valid 10-digit numeric PNR number.', 400);
}

try {
    $bookingModel = new Booking();
    $data = $bookingModel->getByPNR($pnr);

    if (!$data) {
        sendJsonResponse(false, null, "No booking record found for PNR {$pnr}. Check the number and retry.", 404);
    }

    sendJsonResponse(true, $data, 'PNR record retrieved successfully.');
} catch (Throwable $e) {
    error_log("Check PNR error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to retrieve PNR details: ' . $e->getMessage(), 500);
}

