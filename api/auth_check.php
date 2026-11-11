<?php
/**
 * RailGo — REST API: Auth Check & Session Status
 * GET /api/auth_check.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/models/User.php';

setRestHeaders();

$userModel = new User();
$currentUser = $userModel->getCurrentUser();
$csrfToken = generateCsrfToken();

sendJsonResponse(true, [
    'logged_in'  => ($currentUser !== null),
    'user'       => $currentUser,
    'csrf_token' => $csrfToken
], 'Session status retrieved.');
