<?php
require __DIR__ . '/../backend/db.php';

$pdo = getDB();

$users = $pdo->query('SELECT id, email, created_at FROM users ORDER BY id')->fetchAll();
echo "Users in database: " . count($users) . PHP_EOL;
foreach ($users as $u) {
    echo "  [{$u['id']}] {$u['email']} ({$u['created_at']})" . PHP_EOL;
}

echo PHP_EOL;
$tokens = $pdo->query('SELECT COUNT(*) as cnt FROM tokens')->fetch();
echo "Active tokens: {$tokens['cnt']}" . PHP_EOL;
