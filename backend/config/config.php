<?php
/**
 * RailGo — Application Configuration & Security Core
 * Compatible with PHP 8+ and XAMPP environment.
 */

// 1. Error Reporting & Resource Configuration
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('memory_limit', '512M');
error_reporting(E_ALL);

// 2. Database Connection Credentials
// Reads environment variables if set; defaults to standard XAMPP configuration
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'railway_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '958814');
define('DB_CHARSET', 'utf8mb4');

// 3. Security & Session Initialization
if (session_status() === PHP_SESSION_NONE) {
    // Hardened session cookie parameters
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_samesite', 'Lax');

    session_start();
}

// 4. CORS & JSON Response Headers
function setRestHeaders(): void {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');

        // Allow local origin for frontend/backend integration
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}

// 5. Standardized JSON Response Formatter
function sendJsonResponse(bool $success, mixed $data = null, string $message = '', int $statusCode = 200): void {
    setRestHeaders();
    http_response_code($statusCode);

    echo json_encode([
        'status'  => $success ? 'success' : 'error',
        'message' => $message,
        'data'    => $data,
        'timestamp' => time()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 6. CSRF Protection Helpers
function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCsrfToken(?string $token): bool {
    if (empty($token) || empty($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

// 7. Sliding-Window Rate Limiting Helper (e.g. for PNR inquiries)
function checkRateLimit(string $key, int $maxAttempts = 30, int $windowSeconds = 60): bool {
    $now = time();
    $sessionKey = 'rate_' . md5($key);

    if (!isset($_SESSION[$sessionKey]) || !is_array($_SESSION[$sessionKey])) {
        $_SESSION[$sessionKey] = [];
    }

    // Filter out attempts older than current window
    $_SESSION[$sessionKey] = array_filter(
        $_SESSION[$sessionKey],
        fn($timestamp) => ($now - $timestamp) < $windowSeconds
    );

    if (count($_SESSION[$sessionKey]) >= $maxAttempts) {
        return false; // Rate limit exceeded
    }

    $_SESSION[$sessionKey][] = $now;
    return true;
}

// 8. Safe Request Body Parser for application/json payloads
function getJsonPayload(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST;
    }
    // Remove UTF-8 BOM if present
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', trim($raw));
    $decoded = json_decode($raw, true);
    if (is_array($decoded) && !empty($decoded)) {
        return $decoded;
    }
    return !empty($_POST) ? $_POST : (is_array($decoded) ? $decoded : []);
}

