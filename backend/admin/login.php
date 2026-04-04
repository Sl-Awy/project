<?php

// ── Session & DB ───────────────────────────────────────────────────────

ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');

session_start();
require_once __DIR__ . '/../db.php';

if (isset($_SESSION['admin_user_id'])) {
    header('Location: posts.php');
    exit;
}

// ── CSRF ───────────────────────────────────────────────────────────────

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// ── Handle POST ────────────────────────────────────────────────────────

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $expected = $_SESSION['csrf_token'] ?? '';
    $provided = $_POST['csrf_token'] ?? '';

    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        $error = 'Session expired. Please reload the page and try again.';
    } else {
        $email    = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($email === '' || $password === '') {
            $error = 'Email and password are required.';
        } else {
            $pdo  = getDB();
            $stmt = $pdo->prepare('SELECT id, email, name, password, role FROM users WHERE email = :e');
            $stmt->execute([':e' => $email]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password'])) {
                $error = 'Invalid email or password.';
            } elseif ($user['role'] !== 'admin') {
                $error = 'Access denied. Admin privileges required.';
            } else {
                session_regenerate_id(true);
                $_SESSION['admin_user_id'] = $user['id'];
                header('Location: posts.php');
                exit;
            }
        }
    }
}

$csrfToken = $_SESSION['csrf_token'];

// ── HTML ───────────────────────────────────────────────────────────────

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <div class="container">
        <div class="row justify-content-center mt-5 px-3">
            <div class="col-12 col-sm-8 col-md-6 col-lg-5">
                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <h3 class="card-title text-center mb-4">Admin Panel</h3>

                        <?php if ($error): ?>
                            <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
                        <?php endif; ?>

                        <form method="POST">
                            <input type="hidden" name="csrf_token"
                                   value="<?= htmlspecialchars($csrfToken) ?>">

                            <div class="mb-3">
                                <label for="email" class="form-label">Email</label>
                                <input type="email" class="form-control" id="email" name="email"
                                       value="<?= htmlspecialchars($_POST['email'] ?? '') ?>"
                                       required autofocus>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="password"
                                       name="password" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Log In</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
