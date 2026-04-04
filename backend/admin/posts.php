<?php

// ── Auth & DB ──────────────────────────────────────────────────────────

require_once __DIR__ . '/auth_check.php';

$pdo = getDB();
$action      = $_GET['action'] ?? 'list';
$message     = '';
$messageType = '';

$uploadsDir = __DIR__ . '/../uploads';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}

// ── Handle POST requests ───────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrf()) {
        $message     = 'Session expired. Please try again.';
        $messageType = 'danger';
    }

    $postAction = ($messageType !== 'danger') ? ($_POST['action'] ?? '') : '';

    if ($postAction === 'delete') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            $pdo->prepare('DELETE FROM comments WHERE article_id = :id')
                ->execute([':id' => $id]);
            $pdo->prepare('DELETE FROM articles WHERE id = :id')
                ->execute([':id' => $id]);
            $message     = 'Post deleted successfully.';
            $messageType = 'success';
        }
        $action = 'list';

    } elseif ($postAction === 'add' || $postAction === 'edit') {
        $id    = (int) ($_POST['id'] ?? 0);
        $title = trim($_POST['title'] ?? '');
        $body  = trim($_POST['body'] ?? '');

        if ($title === '' || $body === '') {
            $message     = 'Title and text are required.';
            $messageType = 'danger';
            $action = $postAction;
        } else {
            $imageUrl = null;

            if ($postAction === 'edit' && $id > 0) {
                $old = $pdo->prepare('SELECT image_url FROM articles WHERE id = :id');
                $old->execute([':id' => $id]);
                $row = $old->fetch();
                $imageUrl = $row ? $row['image_url'] : null;
            }

            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                $finfo   = finfo_open(FILEINFO_MIME_TYPE);
                $mime    = finfo_file($finfo, $_FILES['image']['tmp_name']);
                finfo_close($finfo);

                if (!in_array($mime, $allowed, true)) {
                    $message     = 'Invalid image format. Allowed: JPEG, PNG, GIF, WebP.';
                    $messageType = 'danger';
                    $action = $postAction;
                } else {
                    $ext = match ($mime) {
                        'image/jpeg' => 'jpg',
                        'image/png'  => 'png',
                        'image/gif'  => 'gif',
                        'image/webp' => 'webp',
                        default      => 'jpg',
                    };
                    $filename = uniqid('img_', true) . '.' . $ext;
                    $destPath = $uploadsDir . '/' . $filename;

                    if (move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
                        $imageUrl = 'uploads/' . $filename;
                    } else {
                        $message     = 'Failed to save uploaded image.';
                        $messageType = 'danger';
                        $action = $postAction;
                    }
                }
            }

            if ($messageType !== 'danger') {
                $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $safeBody  = htmlspecialchars($body, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

                if ($postAction === 'add') {
                    $stmt = $pdo->prepare(
                        'INSERT INTO articles (user_id, title, body, image_url) VALUES (:uid, :t, :b, :img)'
                    );
                    $stmt->execute([
                        ':uid' => $adminUser['id'],
                        ':t'   => $safeTitle,
                        ':b'   => $safeBody,
                        ':img' => $imageUrl,
                    ]);
                    $message     = 'Post created successfully.';
                    $messageType = 'success';
                } else {
                    $stmt = $pdo->prepare(
                        'UPDATE articles SET title = :t, body = :b, image_url = :img WHERE id = :id'
                    );
                    $stmt->execute([
                        ':t'   => $safeTitle,
                        ':b'   => $safeBody,
                        ':img' => $imageUrl,
                        ':id'  => $id,
                    ]);
                    $message     = 'Post updated successfully.';
                    $messageType = 'success';
                }
                $action = 'list';
            }
        }
    }
}

// ── Load data ──────────────────────────────────────────────────────────

$editPost = null;
if ($action === 'edit') {
    $editId = (int) ($_GET['id'] ?? $_POST['id'] ?? 0);
    if ($editId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM articles WHERE id = :id');
        $stmt->execute([':id' => $editId]);
        $editPost = $stmt->fetch();
    }
    if (!$editPost) {
        $message     = 'Post not found.';
        $messageType = 'danger';
        $action = 'list';
    }
}

$posts = [];
if ($action === 'list') {
    $stmt = $pdo->query('
        SELECT a.id, a.title, a.body, a.image_url, a.created_at,
               u.name AS author_name, u.email AS author_email,
               (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comment_count
        FROM articles a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
    ');
    $posts = $stmt->fetchAll();
}

// ── Template ───────────────────────────────────────────────────────────

$pageTitle  = 'Post Management — Admin';
$activePage = 'posts';
include __DIR__ . '/templates/header.php';
?>

<?php if ($message): ?>
    <div class="alert alert-<?= htmlspecialchars($messageType) ?> alert-dismissible fade show">
        <?= htmlspecialchars($message) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
<?php endif; ?>

<?php if ($action === 'list'): ?>

    <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>All Posts</h2>
        <a href="posts.php?action=add" class="btn btn-primary">
            <i class="bi bi-plus-lg"></i> Add Post
        </a>
    </div>

    <div class="table-responsive">
        <table class="table table-striped table-hover bg-white">
            <thead class="table-dark">
                <tr>
                    <th>ID</th>
                    <th class="d-none d-md-table-cell">Image</th>
                    <th>Title</th>
                    <th class="d-none d-sm-table-cell">Author</th>
                    <th>Comments</th>
                    <th class="d-none d-md-table-cell">Created</th>
                    <th class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($posts)): ?>
                    <tr>
                        <td colspan="7" class="text-center text-muted py-4">No posts yet.</td>
                    </tr>
                <?php endif; ?>
                <?php foreach ($posts as $post): ?>
                    <tr>
                        <td><?= (int) $post['id'] ?></td>
                        <td class="d-none d-md-table-cell">
                            <?php if ($post['image_url']): ?>
                                <?php
                                    $imgSrc = $post['image_url'];
                                    if (!preg_match('#^https?://#', $imgSrc)) {
                                        $imgSrc = '../' . $imgSrc;
                                    }
                                ?>
                                <img src="<?= htmlspecialchars($imgSrc) ?>" alt=""
                                     style="width:60px;height:40px;object-fit:cover;border-radius:4px;">
                            <?php else: ?>
                                <span class="text-muted">&mdash;</span>
                            <?php endif; ?>
                        </td>
                        <td><?= htmlspecialchars(mb_strimwidth($post['title'], 0, 60, '...')) ?></td>
                        <td class="d-none d-sm-table-cell">
                            <?= htmlspecialchars($post['author_name'] ?? $post['author_email'] ?? '—') ?>
                        </td>
                        <td><?= (int) $post['comment_count'] ?></td>
                        <td class="d-none d-md-table-cell"><?= htmlspecialchars($post['created_at']) ?></td>
                        <td class="text-end text-nowrap">
                            <a href="posts.php?action=edit&id=<?= (int) $post['id'] ?>"
                               class="btn btn-sm btn-outline-primary mb-1">
                                <i class="bi bi-pencil"></i><span class="d-none d-lg-inline"> Edit</span>
                            </a>
                            <form method="POST" class="d-inline"
                                  onsubmit="return confirm('Delete this post and all its comments?');">
                                <?= csrfField() ?>
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="id" value="<?= (int) $post['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-outline-danger mb-1">
                                    <i class="bi bi-trash"></i><span class="d-none d-lg-inline"> Delete</span>
                                </button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

<?php elseif ($action === 'add' || $action === 'edit'): ?>

    <div class="d-flex align-items-center mb-3">
        <a href="posts.php" class="btn btn-outline-secondary me-3">
            <i class="bi bi-arrow-left"></i> Back
        </a>
        <h2 class="mb-0"><?= $action === 'add' ? 'Add New Post' : 'Edit Post' ?></h2>
    </div>

    <div class="card shadow-sm">
        <div class="card-body">
            <form method="POST" enctype="multipart/form-data">
                <?= csrfField() ?>
                <input type="hidden" name="action" value="<?= htmlspecialchars($action) ?>">
                <?php if ($action === 'edit' && $editPost): ?>
                    <input type="hidden" name="id" value="<?= (int) $editPost['id'] ?>">
                <?php endif; ?>

                <div class="mb-3">
                    <label for="title" class="form-label">Title <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="title" name="title"
                           value="<?= htmlspecialchars($editPost['title'] ?? $_POST['title'] ?? '') ?>"
                           required>
                </div>

                <div class="mb-3">
                    <label for="body" class="form-label">Text <span class="text-danger">*</span></label>
                    <textarea class="form-control" id="body" name="body" rows="8"
                              required><?= htmlspecialchars($editPost['body'] ?? $_POST['body'] ?? '') ?></textarea>
                </div>

                <div class="mb-3">
                    <label for="image" class="form-label">Image</label>
                    <input type="file" class="form-control" id="image" name="image"
                           accept="image/jpeg,image/png,image/gif,image/webp">
                    <div class="form-text">Allowed formats: JPEG, PNG, GIF, WebP.</div>
                    <?php if ($action === 'edit' && $editPost && $editPost['image_url']): ?>
                        <?php
                            $currentImg = $editPost['image_url'];
                            if (!preg_match('#^https?://#', $currentImg)) {
                                $currentImg = '../' . $currentImg;
                            }
                        ?>
                        <div class="mt-2">
                            <small class="text-muted">Current image:</small><br>
                            <img src="<?= htmlspecialchars($currentImg) ?>" alt=""
                                 class="mt-1 img-fluid" style="max-width:200px;border-radius:4px;">
                        </div>
                    <?php endif; ?>
                </div>

                <div class="d-flex flex-wrap gap-2">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-check-lg"></i>
                        <?= $action === 'add' ? 'Create Post' : 'Save Changes' ?>
                    </button>
                    <a href="posts.php" class="btn btn-outline-secondary">Cancel</a>
                </div>
            </form>
        </div>
    </div>

<?php endif; ?>

<?php include __DIR__ . '/templates/footer.php'; ?>
