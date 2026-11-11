<?php
/**
 * RailGo — User Authentication & Session OOP Model
 * Manages bcrypt password hashing, secure sessions, registration and profile retrieval.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/Database.php';

class User {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Register a new user with secure password hashing.
     *
     * @param string $name
     * @param string $email
     * @param string $password
     * @return array User profile
     * @throws InvalidArgumentException|Exception
     */
    public function register(string $name, string $email, string $password): array {
        $cleanName = trim($name);
        $cleanEmail = strtolower(trim($email));

        if (strlen($cleanName) < 2) {
            throw new InvalidArgumentException("Full name must be at least 2 characters.");
        }
        if (!filter_var($cleanEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("Please enter a valid email address.");
        }
        if (strlen($password) < 6) {
            throw new InvalidArgumentException("Password must be at least 6 characters.");
        }

        // Check duplicate email
        $checkStmt = $this->db->prepare("SELECT id FROM `users` WHERE email = :email LIMIT 1");
        $checkStmt->execute([':email' => $cleanEmail]);
        if ($checkStmt->fetch()) {
            throw new Exception("An account with this email address already exists.");
        }

        // Secure password hash
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $this->db->prepare(
            "INSERT INTO `users` (name, email, password_hash, role, created_at)
             VALUES (:name, :email, :hash, 'user', NOW())"
        );
        $stmt->execute([
            ':name'  => $cleanName,
            ':email' => $cleanEmail,
            ':hash'  => $passwordHash
        ]);

        $userId = (int)$this->db->lastInsertId();

        // Secure session initiation
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['user_name'] = $cleanName;
        $_SESSION['user_email'] = $cleanEmail;
        $_SESSION['user_role'] = 'user';

        return [
            'id'    => $userId,
            'name'  => $cleanName,
            'email' => $cleanEmail,
            'role'  => 'user'
        ];
    }

    /**
     * Authenticate user with email and password.
     *
     * @param string $email
     * @param string $password
     * @return array
     * @throws Exception
     */
    public function login(string $email, string $password): array {
        $cleanEmail = strtolower(trim($email));

        if (empty($cleanEmail) || empty($password)) {
            throw new InvalidArgumentException("Email and password are required.");
        }

        $stmt = $this->db->prepare(
            "SELECT id, name, email, password_hash, role FROM `users` WHERE email = :email LIMIT 1"
        );
        $stmt->execute([':email' => $cleanEmail]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new Exception("Invalid email or password combination.");
        }

        // Prevent session fixation
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['user_name'] = $user['name'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_role'] = $user['role'];

        return [
            'id'    => (int)$user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role']
        ];
    }

    /**
     * Log out current session.
     */
    public function logout(): void {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }

    /**
     * Retrieve current logged in user from session.
     *
     * @return array|null
     */
    public function getCurrentUser(): ?array {
        if (!empty($_SESSION['user_id'])) {
            return [
                'id'    => (int)$_SESSION['user_id'],
                'name'  => $_SESSION['user_name'] ?? '',
                'email' => $_SESSION['user_email'] ?? '',
                'role'  => $_SESSION['user_role'] ?? 'user'
            ];
        }
        return null;
    }

    /**
     * Get user profile by ID.
     */
    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT id, name, email, role, created_at FROM `users` WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }
}

