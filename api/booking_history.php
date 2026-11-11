<?php
/**
 * RailGo — REST API: Booking History
 * GET /api/booking_history.php?limit=10
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/Booking.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse(false, null, 'Method not allowed. Use GET.', 405);
}

$userId = !empty($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
$limit = min(50, max(1, (int)($_GET['limit'] ?? 10)));

try {
    $bookingModel = new Booking();
    $history = $bookingModel->getHistory($userId, $limit);

    sendJsonResponse(true, $history, 'Booking history retrieved.');
} catch (Throwable $e) {
    error_log("Booking history error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to retrieve booking history: ' . $e->getMessage(), 500);
}

