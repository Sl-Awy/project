<?php

require_once __DIR__ . '/db.php';

const TOKEN_LIFETIME_HOURS = 24;
const MAX_LOGIN_ATTEMPTS   = 5;
const RATE_LIMIT_WINDOW    = 15; // minutes
const MAX_EMAIL_LENGTH     = 254;
const MAX_PASSWORD_LENGTH  = 72; // bcrypt silently truncates beyond this
const MIN_PASSWORD_LENGTH  = 8;

function generateToken(): string
{
    return bin2hex(random_bytes(32));
}

function getClientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

function isRateLimited(PDO $pdo, string $ip): bool
{
    $stmt = $pdo->prepare('
        SELECT COUNT(*) AS cnt FROM login_attempts
        WHERE ip_address = :ip
          AND attempted_at > datetime("now", :window)
    ');
    $stmt->execute([':ip' => $ip, ':window' => '-' . RATE_LIMIT_WINDOW . ' minutes']);
    return $stmt->fetch()['cnt'] >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(PDO $pdo, string $ip): void
{
    $stmt = $pdo->prepare('INSERT INTO login_attempts (ip_address) VALUES (:ip)');
    $stmt->execute([':ip' => $ip]);
}

function clearFailedAttempts(PDO $pdo, string $ip): void
{
    $stmt = $pdo->prepare('DELETE FROM login_attempts WHERE ip_address = :ip');
    $stmt->execute([':ip' => $ip]);
}

function cleanExpiredTokens(PDO $pdo): void
{
    $pdo->exec('DELETE FROM tokens WHERE created_at < datetime("now", "-' . TOKEN_LIFETIME_HOURS . ' hours")');
    $pdo->exec('DELETE FROM login_attempts WHERE attempted_at < datetime("now", "-' . RATE_LIMIT_WINDOW . ' minutes")');
}

function sanitize(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function getCurrentUser(): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return null;
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('
        SELECT u.id, u.email, u.name, u.role, u.avatar_url, u.bio
        FROM tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token = :token
          AND t.created_at > datetime("now", :lifetime)
    ');
    $stmt->execute([
        ':token'    => $m[1],
        ':lifetime' => '-' . TOKEN_LIFETIME_HOURS . ' hours',
    ]);
    return $stmt->fetch() ?: null;
}

/** User registration: validate input, hash password, insert user row */
function handleSignup(array $params = []): void
{
    $input           = json_decode(file_get_contents('php://input'), true);
    $email           = trim($input['email'] ?? '');
    $password        = $input['password'] ?? '';
    $confirmPassword = $input['confirm_password'] ?? '';

    if ($email === '' || $password === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Email and password are required.',
        ]);
        return;
    }

    if (strlen($email) > MAX_EMAIL_LENGTH) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Email address is too long.',
        ]);
        return;
    }

    if (strlen($password) > MAX_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Password must not exceed ' . MAX_PASSWORD_LENGTH . ' characters.',
        ]);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Please enter a valid email address.',
        ]);
        return;
    }

    // 1. Check if this email is already registered
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :e');
    $stmt->execute([':e' => $email]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'This email address is already registered.',
        ]);
        return;
    }

    // 2. Verify the email domain has MX records (i.e. can actually receive mail)
    $domain = substr($email, strpos($email, '@') + 1);
    if (!checkdnsrr($domain, 'MX')) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'This email address does not exist.',
        ]);
        return;
    }

    // 3. Check that password and confirmation match
    if ($password !== $confirmPassword) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Password and password confirmation do not match.',
        ]);
        return;
    }

    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Password must be at least ' . MIN_PASSWORD_LENGTH . ' characters.',
        ]);
        return;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (email, password) VALUES (:e, :p)');
    $stmt->execute([':e' => sanitize($email), ':p' => $hash]);

    echo json_encode([
        'success' => true,
        'data'    => ['message' => 'Account created successfully.'],
    ]);
}

/** Authentication: verify password, rotate API token for this user */
function handleLogin(array $params = []): void
{
    $input    = json_decode(file_get_contents('php://input'), true);
    $email    = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if ($email === '' || $password === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Email and password are required.',
        ]);
        return;
    }

    if (strlen($email) > MAX_EMAIL_LENGTH || strlen($password) > MAX_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Email or password exceeds maximum length.',
        ]);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Please enter a valid email address.',
        ]);
        return;
    }

    $pdo = getDB();
    $ip  = getClientIp();

    if (isRateLimited($pdo, $ip)) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Too many login attempts. Please try again later.',
        ]);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, email, name, password, role, avatar_url FROM users WHERE email = :e');
    $stmt->execute([':e' => sanitize($email)]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        recordFailedAttempt($pdo, $ip);
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Invalid email or password.',
        ]);
        return;
    }

    clearFailedAttempts($pdo, $ip);

    $pdo->prepare('DELETE FROM tokens WHERE user_id = :uid')
        ->execute([':uid' => $user['id']]);

    cleanExpiredTokens($pdo);

    $token = generateToken();
    $stmt  = $pdo->prepare('INSERT INTO tokens (user_id, token) VALUES (:uid, :t)');
    $stmt->execute([':uid' => $user['id'], ':t' => $token]);

    echo json_encode([
        'success' => true,
        'data'    => [
            'token' => $token,
            'user'  => [
                'id'         => (int) $user['id'],
                'email'      => $user['email'],
                'name'       => $user['name'] ?? null,
                'avatar_url' => $user['avatar_url'] ?? null,
                'role'       => $user['role'] ?? 'user',
            ],
        ],
    ]);
}

function handleLogout(array $params = []): void
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        $pdo  = getDB();
        $stmt = $pdo->prepare('DELETE FROM tokens WHERE token = :t');
        $stmt->execute([':t' => $m[1]]);
    }

    echo json_encode(['success' => true, 'data' => null]);
}

/** Current user from bearer token (session check for the SPA) */
function handleMe(array $params = []): void
{
    $user = getCurrentUser();

    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'data'    => null,
            'error'   => 'Not authenticated.',
        ]);
        return;
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'user' => [
                'id'         => (int) $user['id'],
                'email'      => $user['email'],
                'name'       => $user['name'] ?? null,
                'avatar_url' => $user['avatar_url'] ?? null,
                'role'       => $user['role'] ?? 'user',
            ],
        ],
    ]);
}
