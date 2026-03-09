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

function csrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfField(): string
{
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrfToken()) . '">';
}

function verifyCsrf(): void
{
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        die('Invalid request. Please reload the page and try again.');
    }
}
