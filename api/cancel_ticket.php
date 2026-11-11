<?php
/**
 * RailGo — REST API: Cancel Ticket
 * POST /api/cancel_ticket.php
 * Payload: { pnr: "4827361950" }
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/Booking.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$payload = getJsonPayload();
$pnr = trim($payload['pnr'] ?? '');

if (!preg_match('/^\d{10}$/', $pnr)) {
    sendJsonResponse(false, null, 'Please provide a valid 10-digit numeric PNR number.', 400);
}

try {
    $bookingModel = new Booking();
    $result = $bookingModel->cancel($pnr);

    sendJsonResponse(true, $result, $result['message']);
} catch (InvalidArgumentException $e) {
    sendJsonResponse(false, null, $e->getMessage(), 422);
} catch (Throwable $e) {
    error_log("Cancel ticket error: " . $e->getMessage());
    sendJsonResponse(false, null, $e->getMessage(), 400);
}
