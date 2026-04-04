<?php

ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../db.php';

// ── Admin gate ─────────────────────────────────────────────────────────

if (!isset($_SESSION['admin_user_id'])) {
    header('Location: login.php');
    exit;
}

$pdo = getDB();
$stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = :id AND role = :role');
$stmt->execute([':id' => $_SESSION['admin_user_id'], ':role' => 'admin']);
$adminUser = $stmt->fetch();

if (!$adminUser) {
    session_destroy();
    header('Location: login.php');
    exit;
}

// ── CSRF helpers ───────────────────────────────────────────────────────

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function csrfToken(): string
{
    return $_SESSION['csrf_token'];
}

function csrfField(): string
{
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrfToken()) . '">';
}

/**
 * Returns true when the token is valid, false otherwise.
 */
function verifyCsrf(): bool
{
    $expected = $_SESSION['csrf_token'] ?? '';
    $provided = $_POST['csrf_token'] ?? '';

    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        return false;
    }
    return true;
}
