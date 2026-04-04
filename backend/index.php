<?php

// When using PHP's built-in server, serve existing files directly
// (admin panel pages, uploaded images, etc.)
if (php_sapi_name() === 'cli-server') {
    $requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $filePath    = __DIR__ . $requestPath;

    if ($requestPath !== '/' && is_file($filePath)) {
        if (preg_match('/\.php$/i', $filePath)) {
            return false;
        }
        $mimeTypes = [
            'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',  'gif'  => 'image/gif',
            'webp' => 'image/webp','css'  => 'text/css',
            'js'  => 'application/javascript',
            'svg' => 'image/svg+xml',
        ];
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if (isset($mimeTypes[$ext])) {
            header('Content-Type: ' . $mimeTypes[$ext]);
            readfile($filePath);
            return;
        }
        return false;
    }
}

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
define('MAX_MESSAGE_BODY_LENGTH', 4000);
define('USER_SEARCH_MAX_LIMIT', 50);

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

if (preg_match('#^/api/articles/(\d+)/comments/(\d+)$#', $uri, $m)) {
    $routeParams['id'] = (int) $m[1];
    $routeParams['comment_id'] = (int) $m[2];
    $matched = $method === 'DELETE' ? 'handleDeleteComment' : null;
} elseif (preg_match('#^/api/articles/(\d+)/comments$#', $uri, $m)) {
    $routeParams['id'] = (int) $m[1];
    $matched = $method === 'GET'  ? 'handleGetComments'
             : ($method === 'POST' ? 'handleCreateComment' : null);
} elseif ($method === 'POST' && preg_match('#^/api/articles/(\d+)/like$#', $uri, $m)) {
    $matched = 'handleToggleLike';
    $routeParams['id'] = (int) $m[1];
} elseif (preg_match('#^/api/articles/(\d+)$#', $uri, $m)) {
    $routeParams['id'] = (int) $m[1];
    $matched = $method === 'GET'    ? 'handleGetArticle'
             : ($method === 'DELETE' ? 'handleDeleteArticle' : null);
} elseif ($method === 'GET' && $uri === '/api/users/search') {
    $matched = 'handleSearchUsers';
} elseif ($method === 'POST' && preg_match('#^/api/users/(\d+)/follow$#', $uri, $m)) {
    $matched = 'handleFollowUser';
    $routeParams['id'] = (int) $m[1];
} elseif ($method === 'DELETE' && preg_match('#^/api/users/(\d+)/follow$#', $uri, $m)) {
    $matched = 'handleUnfollowUser';
    $routeParams['id'] = (int) $m[1];
} elseif ($method === 'GET' && $uri === '/api/messenger/conversations') {
    $matched = 'handleMessengerConversations';
} elseif ($method === 'GET' && $uri === '/api/messenger/messages') {
    $matched = 'handleGetMessages';
} elseif ($method === 'POST' && $uri === '/api/messenger/messages') {
    $matched = 'handleSendMessage';
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
    $filterUserId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;

    $pdo = getDB();

    $whereClause = $filterUserId ? 'WHERE a.user_id = :filter_uid' : '';

    $countSql = "SELECT COUNT(*) FROM articles a $whereClause";
    $countStmt = $pdo->prepare($countSql);
    if ($filterUserId) {
        $countStmt->bindValue(':filter_uid', $filterUserId, PDO::PARAM_INT);
    }
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();
    $totalPages = max(1, (int) ceil($total / ARTICLES_PER_PAGE));

    $stmt = $pdo->prepare("
        SELECT a.id, a.title, a.body, a.image_url, a.created_at,
               u.id AS user_id, u.name, u.email, u.avatar_url,
               (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS like_count,
               (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comment_count,
               EXISTS(SELECT 1 FROM likes l WHERE l.article_id = a.id AND l.user_id = :uid) AS user_has_liked
        FROM articles a
        JOIN users u ON u.id = a.user_id
        $whereClause
        ORDER BY a.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':uid',    (int) $user['id'], PDO::PARAM_INT);
    if ($filterUserId) {
        $stmt->bindValue(':filter_uid', $filterUserId, PDO::PARAM_INT);
    }
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
// Delete handlers
// ──────────────────────────────────────────

function handleDeleteArticle(array $params = []): void
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
    $stmt = $pdo->prepare('SELECT id, user_id FROM articles WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $article = $stmt->fetch();

    if (!$article) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
        return;
    }

    $isOwner = (int) $article['user_id'] === (int) $user['id'];
    $isAdmin = ($user['role'] ?? '') === 'admin';

    if (!$isOwner && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'You do not have permission to delete this article.']);
        return;
    }

    $pdo->prepare('DELETE FROM likes WHERE article_id = :id')->execute([':id' => $id]);
    $pdo->prepare('DELETE FROM comments WHERE article_id = :id')->execute([':id' => $id]);
    $pdo->prepare('DELETE FROM articles WHERE id = :id')->execute([':id' => $id]);

    echo json_encode(['success' => true, 'data' => null]);
}

function handleDeleteComment(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $articleId = $params['id'] ?? 0;
    $commentId = $params['comment_id'] ?? 0;

    if ($articleId <= 0 || $commentId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid IDs.']);
        return;
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, user_id FROM comments WHERE id = :cid AND article_id = :aid');
    $stmt->execute([':cid' => $commentId, ':aid' => $articleId]);
    $comment = $stmt->fetch();

    if (!$comment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Comment not found.']);
        return;
    }

    $isOwner = (int) $comment['user_id'] === (int) $user['id'];
    $isAdmin = ($user['role'] ?? '') === 'admin';

    if (!$isOwner && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'You do not have permission to delete this comment.']);
        return;
    }

    $pdo->prepare('DELETE FROM comments WHERE id = :id')->execute([':id' => $commentId]);

    echo json_encode(['success' => true, 'data' => null]);
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

// ──────────────────────────────────────────
// User search & follows (messenger)
// ──────────────────────────────────────────

function escapeLikePattern(string $q): string
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $q);
}

function handleSearchUsers(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $q = trim($_GET['q'] ?? '');
    if ($q === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Search query is required.']);
        return;
    }

    $limit = min(USER_SEARCH_MAX_LIMIT, max(1, (int) ($_GET['limit'] ?? 20)));
    $me    = (int) $user['id'];
    $pat   = '%' . escapeLikePattern($q) . '%';

    $pdo  = getDB();
    $stmt = $pdo->prepare('
        SELECT u.id, u.name, u.avatar_url, u.bio,
               EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = :me AND f.followed_id = u.id) AS is_following,
               EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = u.id AND f2.followed_id = :me2) AS follows_you
        FROM users u
        WHERE u.id != :uid
          AND (
            u.name LIKE :pat ESCAPE \'\\\'
            OR LOWER(u.email) LIKE LOWER(:pat2)
          )
        ORDER BY (CASE WHEN u.name IS NULL OR TRIM(u.name) = \'\' THEN 1 ELSE 0 END), u.name COLLATE NOCASE
        LIMIT :lim
    ');
    $stmt->bindValue(':me',   $me, PDO::PARAM_INT);
    $stmt->bindValue(':me2',  $me, PDO::PARAM_INT);
    $stmt->bindValue(':uid',  $me, PDO::PARAM_INT);
    $stmt->bindValue(':pat',  $pat);
    $stmt->bindValue(':pat2', $pat);
    $stmt->bindValue(':lim',  $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id']           = (int) $row['id'];
        $row['is_following'] = (bool) $row['is_following'];
        $row['follows_you']  = (bool) $row['follows_you'];
    }

    echo json_encode(['success' => true, 'data' => $rows]);
}

function handleFollowUser(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $targetId = $params['id'] ?? 0;
    if ($targetId <= 0 || $targetId === (int) $user['id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid user.']);
        return;
    }

    $pdo = getDB();

    $exists = $pdo->prepare('SELECT id FROM users WHERE id = :id');
    $exists->execute([':id' => $targetId]);
    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'User not found.']);
        return;
    }

    $stmt = $pdo->prepare('INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (:f, :t)');
    $stmt->execute([':f' => $user['id'], ':t' => $targetId]);

    echo json_encode(['success' => true, 'data' => ['following' => true]]);
}

function handleUnfollowUser(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $targetId = $params['id'] ?? 0;
    if ($targetId <= 0 || $targetId === (int) $user['id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid user.']);
        return;
    }

    $pdo = getDB();
    $pdo->prepare('DELETE FROM follows WHERE follower_id = :f AND followed_id = :t')
        ->execute([':f' => $user['id'], ':t' => $targetId]);

    echo json_encode(['success' => true, 'data' => null]);
}

function messengerThreadAllowed(PDO $pdo, int $me, int $other): bool
{
    if ($me === $other || $other <= 0) {
        return false;
    }

    $stmt = $pdo->prepare('
        SELECT 1 FROM follows WHERE follower_id = :me AND followed_id = :o
        UNION
        SELECT 1 FROM follows WHERE follower_id = :o2 AND followed_id = :me2
        UNION
        SELECT 1 FROM messages
        WHERE (sender_id = :me3 AND receiver_id = :o3)
           OR (sender_id = :o4 AND receiver_id = :me4)
        LIMIT 1
    ');
    $stmt->execute([
        ':me'  => $me,
        ':o'   => $other,
        ':o2'  => $other,
        ':me2' => $me,
        ':me3' => $me,
        ':o3'  => $other,
        ':o4'  => $other,
        ':me4' => $me,
    ]);

    return (bool) $stmt->fetch();
}

function handleMessengerConversations(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $me  = (int) $user['id'];
    $pdo = getDB();

    $stmt = $pdo->prepare('
        SELECT u.id, u.name, u.avatar_url,
               (SELECT m.body FROM messages m
                WHERE (m.sender_id = :me AND m.receiver_id = u.id)
                   OR (m.sender_id = u.id AND m.receiver_id = :me2)
                ORDER BY m.created_at DESC LIMIT 1) AS last_message_body,
               (SELECT m.created_at FROM messages m
                WHERE (m.sender_id = :me3 AND m.receiver_id = u.id)
                   OR (m.sender_id = u.id AND m.receiver_id = :me4)
                ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
        FROM follows f
        JOIN users u ON u.id = f.followed_id
        WHERE f.follower_id = :me5
        ORDER BY COALESCE(
            (SELECT m.created_at FROM messages m
             WHERE (m.sender_id = :me6 AND m.receiver_id = u.id)
                OR (m.sender_id = u.id AND m.receiver_id = :me7)
             ORDER BY m.created_at DESC LIMIT 1),
            f.created_at
        ) DESC
    ');
    $stmt->execute([
        ':me'   => $me,
        ':me2'  => $me,
        ':me3'  => $me,
        ':me4'  => $me,
        ':me5'  => $me,
        ':me6'  => $me,
        ':me7'  => $me,
    ]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
    }

    echo json_encode(['success' => true, 'data' => $rows]);
}

function handleGetMessages(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $other = (int) ($_GET['user_id'] ?? 0);
    if ($other <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'user_id is required.']);
        return;
    }

    $me  = (int) $user['id'];
    $pdo = getDB();

    if (!messengerThreadAllowed($pdo, $me, $other)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'You cannot view this conversation.']);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT m.id, m.sender_id, m.receiver_id, m.body, m.created_at
        FROM messages m
        WHERE (m.sender_id = :me AND m.receiver_id = :o)
           OR (m.sender_id = :o2 AND m.receiver_id = :me2)
        ORDER BY m.created_at ASC
    ');
    $stmt->execute([
        ':me'  => $me,
        ':o'   => $other,
        ':o2'  => $other,
        ':me2' => $me,
    ]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id']          = (int) $row['id'];
        $row['sender_id']   = (int) $row['sender_id'];
        $row['receiver_id'] = (int) $row['receiver_id'];
    }

    echo json_encode(['success' => true, 'data' => $rows]);
}

function handleSendMessage(array $params = []): void
{
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Not authenticated.']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $other = (int) ($input['user_id'] ?? 0);
    $body  = trim($input['body'] ?? '');

    if ($other <= 0 || $body === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'user_id and body are required.']);
        return;
    }

    if (strlen($body) > MAX_MESSAGE_BODY_LENGTH) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Message is too long.']);
        return;
    }

    if ($other === (int) $user['id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid recipient.']);
        return;
    }

    $pdo = getDB();

    $exists = $pdo->prepare('SELECT id FROM users WHERE id = :id');
    $exists->execute([':id' => $other]);
    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'User not found.']);
        return;
    }

    $follows = $pdo->prepare('SELECT 1 FROM follows WHERE follower_id = :me AND followed_id = :o');
    $follows->execute([':me' => $user['id'], ':o' => $other]);
    if (!$follows->fetch()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'data' => null, 'error' => 'You can only message people you follow.']);
        return;
    }

    $safeBody = sanitize($body);

    $stmt = $pdo->prepare('
        INSERT INTO messages (sender_id, receiver_id, body)
        VALUES (:s, :r, :b)
    ');
    $stmt->execute([
        ':s' => $user['id'],
        ':r' => $other,
        ':b' => $safeBody,
    ]);

    $mid = (int) $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'data'    => [
            'id'          => $mid,
            'sender_id'   => (int) $user['id'],
            'receiver_id' => $other,
            'body'        => $safeBody,
            'created_at'  => date('Y-m-d H:i:s'),
        ],
    ]);
}
