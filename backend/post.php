<?php

require_once __DIR__ . '/articles_db.php';

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
    exit;
}

$pdo  = getArticlesDB();
$stmt = $pdo->prepare('
    SELECT id, user_id, author_email AS author, title, body, created_at
    FROM articles
    WHERE id = :id
');
$stmt->execute([':id' => $id]);
$article = $stmt->fetch();

if (!$article) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

echo json_encode(['success' => true, 'data' => $article]);
