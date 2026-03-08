<?php

function getArticlesDB(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    $dbPath = __DIR__ . '/articles.sqlite';

    $pdo = new PDO("sqlite:$dbPath", null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec('PRAGMA journal_mode=WAL');

    migrateArticles($pdo);

    return $pdo;
}

function migrateArticles(PDO $pdo): void
{
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS articles (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL,
            author_email TEXT    NOT NULL,
            title        TEXT    NOT NULL,
            body         TEXT    NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ');
}
