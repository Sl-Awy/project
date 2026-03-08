<?php

require_once __DIR__ . '/database.php';

function migrateUsers(): void
{
    $pdo = getConnection();

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            User_ID   INT            NOT NULL AUTO_INCREMENT,
            USER_NAME VARCHAR(100)   NOT NULL UNIQUE,
            USER_MAIL VARCHAR(255)   NOT NULL UNIQUE,
            USER_PASS VARCHAR(255)   NOT NULL,
            USER_ROLE ENUM('user', 'admin') NOT NULL DEFAULT 'user',
            PRIMARY KEY (User_ID)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    echo "Migration complete — 'users' table is ready.\n";
}

if (php_sapi_name() === 'cli') {
    migrateUsers();
}
