<?php
/**
 * RailGo — Singleton PDO Database Connection Manager
 * Object-Oriented, strict typing, persistent connection pooling.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    /**
     * Private constructor to prevent direct instantiation (Singleton pattern)
     */
    private function __construct() {}

    /**
     * Private clone to prevent duplicating instance
     */
    private function __clone() {}

    /**
     * Get the active PDO database connection instance.
     *
     * @return PDO
     * @throws PDOException
     */
    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                DB_HOST,
                DB_PORT,
                DB_NAME,
                DB_CHARSET
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
            ];

            try {
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (PDOException $e) {
                // In production, do not leak raw credentials; log error message
                error_log("Database connection failed: " . $e->getMessage());
                throw new PDOException("Database connection failure. Check railway_db configuration and server status.");
            }
        }

        return self::$instance;
    }

    /**
     * Check if database connection is alive.
     *
     * @return bool
     */
    public static function isConnected(): bool {
        try {
            $conn = self::getConnection();
            return (bool)$conn->query('SELECT 1');
        } catch (Throwable) {
            return false;
        }
    }
}
