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

define('ARTICLES_PER_PAGE', 5);

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

if (preg_match('#^/api/articles/(\d+)/comments$#', $uri, $m)) {
    $routeParams['id'] = (int) $m[1];
    $matched = $method === 'GET'  ? 'handleGetComments'
             : ($method === 'POST' ? 'handleCreateComment' : null);
} elseif ($method === 'POST' && preg_match('#^/api/articles/(\d+)/like$#', $uri, $m)) {
    $matched = 'handleToggleLike';
    $routeParams['id'] = (int) $m[1];
} elseif ($method === 'GET' && preg_match('#^/api/articles/(\d+)$#', $uri, $m)) {
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

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $offset = ($page - 1) * ARTICLES_PER_PAGE;

    $pdo = getDB();

    $total = (int) $pdo->query('SELECT COUNT(*) FROM articles')->fetchColumn();
    $totalPages = max(1, (int) ceil($total / ARTICLES_PER_PAGE));

    $stmt = $pdo->prepare('
        SELECT a.id, a.title, a.body, a.image_url, a.created_at,
               u.id AS user_id, u.name, u.email, u.avatar_url,
               (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS like_count,
               (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comment_count,
               EXISTS(SELECT 1 FROM likes l WHERE l.article_id = a.id AND l.user_id = :uid) AS user_has_liked
        FROM articles a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT :limit OFFSET :offset
    ');
    $stmt->bindValue(':uid',    (int) $user['id'], PDO::PARAM_INT);
    $stmt->bindValue(':limit',  ARTICLES_PER_PAGE, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset,           PDO::PARAM_INT);
    $stmt->execute();
    $articles = $stmt->fetchAll();

    foreach ($articles as &$a) {
        $a['like_count']     = (int) $a['like_count'];
        $a['comment_count']  = (int) $a['comment_count'];
        $a['user_has_liked'] = (bool) $a['user_has_liked'];
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'articles'    => $articles,
            'page'        => $page,
            'total_pages' => $totalPages,
            'total'       => $total,
        ],
    ]);
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
               u.id AS user_id, u.name, u.email, u.avatar_url,
               (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS like_count,
               (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comment_count,
               EXISTS(SELECT 1 FROM likes l WHERE l.article_id = a.id AND l.user_id = :uid) AS user_has_liked
        FROM articles a
        JOIN users u ON u.id = a.user_id
        WHERE a.id = :id
    ');
    $stmt->execute([':id' => $id, ':uid' => (int) $user['id']]);
    $article = $stmt->fetch();

    if (!$article) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
        return;
    }

    $article['like_count']     = (int) $article['like_count'];
    $article['comment_count']  = (int) $article['comment_count'];
    $article['user_has_liked'] = (bool) $article['user_has_liked'];

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

// ──────────────────────────────────────────
// Comment handlers
// ──────────────────────────────────────────

function handleGetComments(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $articleId = $params['id'] ?? 0;
    if ($articleId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
        return;
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('
        SELECT c.id, c.body, c.created_at,
               u.id AS user_id, u.name, u.email, u.avatar_url
        FROM comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.article_id = :aid
        ORDER BY c.created_at ASC
    ');
    $stmt->execute([':aid' => $articleId]);
    $comments = $stmt->fetchAll();

    echo json_encode(['success' => true, 'data' => $comments]);
}

function handleCreateComment(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $articleId = $params['id'] ?? 0;
    if ($articleId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
        return;
    }

    $pdo = getDB();

    $exists = $pdo->prepare('SELECT id FROM articles WHERE id = :id');
    $exists->execute([':id' => $articleId]);
    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $body  = trim($input['body'] ?? '');

    if ($body === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Comment body is required.']);
        return;
    }

    $safeBody = sanitize($body);

    $stmt = $pdo->prepare('
        INSERT INTO comments (article_id, user_id, body)
        VALUES (:aid, :uid, :body)
    ');
    $stmt->execute([
        ':aid'  => $articleId,
        ':uid'  => $user['id'],
        ':body' => $safeBody,
    ]);

    echo json_encode([
        'success' => true,
        'data'    => [
            'id'         => (int) $pdo->lastInsertId(),
            'body'       => $safeBody,
            'created_at' => date('Y-m-d H:i:s'),
            'user_id'    => (int) $user['id'],
            'name'       => $user['name'] ?? null,
            'email'      => $user['email'],
            'avatar_url' => null,
        ],
    ]);
}

// ──────────────────────────────────────────
// Like handler
// ──────────────────────────────────────────

function handleToggleLike(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $articleId = $params['id'] ?? 0;
    if ($articleId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
        return;
    }

    $pdo = getDB();

    $exists = $pdo->prepare('SELECT id FROM articles WHERE id = :id');
    $exists->execute([':id' => $articleId]);
    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
        return;
    }

    $check = $pdo->prepare('SELECT 1 FROM likes WHERE user_id = :uid AND article_id = :aid');
    $check->execute([':uid' => $user['id'], ':aid' => $articleId]);
    $alreadyLiked = (bool) $check->fetch();

    if ($alreadyLiked) {
        $pdo->prepare('DELETE FROM likes WHERE user_id = :uid AND article_id = :aid')
            ->execute([':uid' => $user['id'], ':aid' => $articleId]);
    } else {
        $pdo->prepare('INSERT INTO likes (user_id, article_id) VALUES (:uid, :aid)')
            ->execute([':uid' => $user['id'], ':aid' => $articleId]);
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM likes WHERE article_id = :aid');
    $stmt->execute([':aid' => $articleId]);
    $count = (int) $stmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'data'    => [
            'liked'      => !$alreadyLiked,
            'like_count' => $count,
        ],
    ]);
}
