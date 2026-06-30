<?php
/**
 * Expects these variables to be set before inclusion:
 *   $pageTitle  — string for <title>
 *   $activePage — 'posts' | 'comments' | 'tasks' (highlights nav item)
 *   $adminUser  — array from auth_check.php
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($pageTitle ?? 'Admin Panel') ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
</head>
<body class="bg-light">

<nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
    <div class="container-fluid">
        <a class="navbar-brand" href="posts.php">Admin Panel</a>
        <button class="navbar-toggler" type="button"
                data-bs-toggle="collapse" data-bs-target="#adminNav"
                aria-controls="adminNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="adminNav">
            <ul class="navbar-nav me-auto">
                <li class="nav-item">
                    <a class="nav-link <?= ($activePage ?? '') === 'posts' ? 'active' : '' ?>"
                       href="posts.php">Posts</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= ($activePage ?? '') === 'comments' ? 'active' : '' ?>"
                       href="comments.php">Comments</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= ($activePage ?? '') === 'tasks' ? 'active' : '' ?>"
                       href="tasks.php">Tasks</a>
                </li>
            </ul>
            <ul class="navbar-nav">
                <li class="nav-item">
                    <span class="nav-link text-light">
                        <i class="bi bi-person-fill"></i>
                        <?= htmlspecialchars($adminUser['name'] ?? $adminUser['email']) ?>
                    </span>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="logout.php"><i class="bi bi-box-arrow-right"></i> Logout</a>
                </li>
            </ul>
        </div>
    </div>
</nav>

<div class="container">
