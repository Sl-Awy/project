<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/articles_db.php';

$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

$routes = [
    'POST /api/auth/signup'  => 'handleSignup',
    'POST /api/auth/login'   => 'handleLogin',
    'POST /api/auth/logout'  => 'handleLogout',
    'GET  /api/auth/me'      => 'handleMe',

    'GET  /api/users'        => 'handleGetUsers',
    'GET  /api/posts'        => 'handleGetPosts',
    'POST /api/posts'        => 'handleCreatePost',

    'GET  /api/articles'     => 'handleGetArticles',
    'POST /api/articles'     => 'handleCreateArticle',
];

$key = "$method $uri";

$matched = null;
foreach ($routes as $pattern => $handler) {
    $parts      = preg_split('/\s+/', $pattern, 2);
    $routeMethod = $parts[0];
    $routePath   = $parts[1];

    if ($routeMethod === $method && $routePath === $uri) {
        $matched = $handler;
        break;
    }
}

if ($matched && function_exists($matched)) {
    $matched();
} else {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'data'    => null,
        'error'   => 'Route not found.',
    ]);
}

// ──────────────────────────────────────────
// Additional resource handlers
// ──────────────────────────────────────────

function handleGetUsers(): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $pdo   = getDB();
    $stmt  = $pdo->query('SELECT id, email, avatar_url, bio, created_at FROM users ORDER BY created_at DESC');
    $users = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $users]);
}

function handleGetPosts(): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $pdo  = getDB();
    $stmt = $pdo->query('
        SELECT p.id, p.content, p.image_url, p.created_at,
               u.id AS user_id, u.email, u.avatar_url
        FROM posts p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
    ');
    $posts = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $posts]);
}

function handleCreatePost(): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $input   = json_decode(file_get_contents('php://input'), true);
    $content = trim($input['content'] ?? '');

    if ($content === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Post content is required.']);
        return;
    }

    $imageUrl = $input['image_url'] ?? null;
    if ($imageUrl !== null) {
        $imageUrl = filter_var($imageUrl, FILTER_VALIDATE_URL);
        if ($imageUrl === false || !preg_match('/^https?:\/\//', $imageUrl)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid image URL.']);
            return;
        }
    }

    $safeContent = sanitize($content);

    $pdo  = getDB();
    $stmt = $pdo->prepare('INSERT INTO posts (user_id, content, image_url) VALUES (:uid, :c, :img)');
    $stmt->execute([
        ':uid' => $user['id'],
        ':c'   => $safeContent,
        ':img' => $imageUrl,
    ]);

    $postId = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'data'    => [
            'id'         => (int) $postId,
            'user_id'    => (int) $user['id'],
            'email'      => $user['email'],
            'content'    => $safeContent,
            'image_url'  => $imageUrl,
            'created_at' => date('Y-m-d H:i:s'),
        ],
    ]);
}

// ──────────────────────────────────────────
// Article handlers
// ──────────────────────────────────────────

function handleGetArticles(): void
{
    $pdo  = getArticlesDB();
    $stmt = $pdo->query('
        SELECT id, user_id, author_email AS author, title, created_at
        FROM articles
        ORDER BY created_at DESC
    ');
    $articles = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $articles]);
}

function handleCreateArticle(): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $title = trim($input['title'] ?? '');
    $body  = trim($input['body']  ?? '');

    if ($title === '' || $body === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Title and body are required.']);
        return;
    }

    $safeTitle = sanitize($title);
    $safeBody  = sanitize($body);

    $pdo  = getArticlesDB();
    $stmt = $pdo->prepare('
        INSERT INTO articles (user_id, author_email, title, body)
        VALUES (:uid, :email, :t, :b)
    ');
    $stmt->execute([
        ':uid'   => $user['id'],
        ':email' => $user['email'],
        ':t'     => $safeTitle,
        ':b'     => $safeBody,
    ]);

    $articleId = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'data'    => [
            'id'         => (int) $articleId,
            'user_id'    => (int) $user['id'],
            'author'     => $user['email'],
            'title'      => $safeTitle,
            'body'       => $safeBody,
            'created_at' => date('Y-m-d H:i:s'),
        ],
    ]);
}
