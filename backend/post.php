<?php

require_once __DIR__ . '/db.php';

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'data' => null, 'error' => 'Invalid article ID.']);
    exit;
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
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'data' => null, 'error' => 'Article not found.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

echo json_encode(['success' => true, 'data' => $article]);
