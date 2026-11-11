<?php
/**
 * RailGo — REST API: Book Ticket
 * POST /api/book_ticket.php
 * Payload: {
 *   train_id: 1,
 *   class_code: "3A",
 *   journey_date: "2026-11-20",
 *   passengers: [ { name: "Aanya", age: 28, gender: "F", berth_pref: "Lower" } ]
 * }
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/Booking.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$payload = getJsonPayload();

if (empty($payload)) {
    sendJsonResponse(false, null, 'Invalid or empty JSON request body.', 400);
}

// Inject session user ID if logged in
if (!empty($_SESSION['user_id']) && empty($payload['user_id'])) {
    $payload['user_id'] = (int)$_SESSION['user_id'];
}

try {
    $bookingModel = new Booking();
    $ticket = $bookingModel->bookTicket($payload);

    sendJsonResponse(true, $ticket, 'Booking confirmed successfully!', 201);
} catch (InvalidArgumentException $e) {
    sendJsonResponse(false, null, $e->getMessage(), 422);
} catch (Throwable $e) {
    error_log("Booking error: " . $e->getMessage());
    sendJsonResponse(false, null, $e->getMessage(), 500);
}

