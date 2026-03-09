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

$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

$routes = [
    'POST /api/auth/signup'  => 'handleSignup',
    'POST /api/auth/login'   => 'handleLogin',
    'POST /api/auth/logout'  => 'handleLogout',
    'GET  /api/auth/me'      => 'handleMe',

    'GET  /api/users'        => 'handleGetUsers',

    'GET  /api/articles'     => 'handleGetArticles',
    'POST /api/articles'     => 'handleCreateArticle',
];

$key = "$method $uri";

$matched = null;
$routeParams = [];

if ($method === 'GET' && preg_match('#^/api/articles/(\d+)$#', $uri, $m)) {
    $matched = 'handleGetArticle';
    $routeParams['id'] = (int) $m[1];
} else {
    foreach ($routes as $pattern => $handler) {
        $parts       = preg_split('/\s+/', $pattern, 2);
        $routeMethod = $parts[0];
        $routePath   = $parts[1];

        if ($routeMethod === $method && $routePath === $uri) {
            $matched = $handler;
            break;
        }
    }
}

if ($matched && function_exists($matched)) {
    $matched($routeParams);
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

function handleGetUsers(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $pdo   = getDB();
    $stmt  = $pdo->query('SELECT id, name, email, avatar_url, bio, created_at FROM users ORDER BY created_at DESC');
    $users = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $users]);
}

// ──────────────────────────────────────────
// Article handlers
// ──────────────────────────────────────────

function handleGetArticles(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $pdo  = getDB();
    $stmt = $pdo->query('
        SELECT a.id, a.title, a.body, a.image_url, a.created_at,
               u.id AS user_id, u.name, u.email, u.avatar_url
        FROM articles a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
    ');
    $articles = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $articles]);
}

function handleGetArticle(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $id = $params['id'] ?? 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
        return;
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('
        SELECT a.id, a.title, a.body, a.image_url, a.created_at,
               u.id AS user_id, u.name, u.email, u.avatar_url
        FROM articles a
        JOIN users u ON u.id = a.user_id
        WHERE a.id = :id
    ');
    $stmt->execute([':id' => $id]);
    $article = $stmt->fetch();

    if (!$article) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
        return;
    }

    echo json_encode(['success' => true, 'data' => $article]);
}

function handleCreateArticle(array $params = []): void
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

    $imageUrl = $input['image_url'] ?? null;
    if ($imageUrl !== null) {
        $imageUrl = filter_var($imageUrl, FILTER_VALIDATE_URL);
        if ($imageUrl === false || !preg_match('/^https?:\/\//', $imageUrl)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid image URL.']);
            return;
        }
    }

    $safeTitle = sanitize($title);
    $safeBody  = sanitize($body);

    $pdo  = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO articles (user_id, title, body, image_url)
        VALUES (:uid, :t, :b, :img)
    ');
    $stmt->execute([
        ':uid' => $user['id'],
        ':t'   => $safeTitle,
        ':b'   => $safeBody,
        ':img' => $imageUrl,
    ]);

    $articleId = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'data'    => [
            'id'         => (int) $articleId,
            'user_id'    => (int) $user['id'],
            'name'       => $user['name'] ?? null,
            'email'      => $user['email'],
            'avatar_url' => $user['avatar_url'] ?? null,
            'title'      => $safeTitle,
            'body'       => $safeBody,
            'image_url'  => $imageUrl,
            'created_at' => date('Y-m-d H:i:s'),
        ],
    ]);
}
