<?php
/**
 * RailGo — REST API: Logout
 * POST /api/logout.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/User.php';

setRestHeaders();

$userModel = new User();
$userModel->logout();

sendJsonResponse(true, null, 'Logged out successfully.');

