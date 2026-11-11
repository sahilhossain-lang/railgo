<?php
/**
 * RailGo — REST API: Login
 * POST /api/login.php
 * Payload: { email: "...", password: "..." }
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/User.php';

setRestHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$payload = getJsonPayload();
$email = trim($payload['email'] ?? '');
$password = trim($payload['password'] ?? '');

try {
    $userModel = new User();
    $user = $userModel->login($email, $password);

    sendJsonResponse(true, $user, 'Login successful.');
} catch (InvalidArgumentException $e) {
    sendJsonResponse(false, null, $e->getMessage(), 422);
} catch (Throwable $e) {
    sendJsonResponse(false, null, $e->getMessage(), 401);
}

