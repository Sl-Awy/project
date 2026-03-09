<?php

// ── Auth & DB ──────────────────────────────────────────────────────────

require_once __DIR__ . '/auth_check.php';

$pdo = getDB();
$message     = '';
$messageType = '';

// ── Handle delete ──────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    verifyCsrf();
    $id = (int) ($_POST['id'] ?? 0);
    if ($id > 0) {
        $pdo->prepare('DELETE FROM comments WHERE id = :id')
            ->execute([':id' => $id]);
        $message     = 'Comment deleted.';
        $messageType = 'success';
    }
}

// ── Load data ──────────────────────────────────────────────────────────

$stmt = $pdo->query('
    SELECT c.id, c.body, c.created_at,
           u.name AS user_name, u.email AS user_email,
           a.id AS article_id, a.title AS article_title
    FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN articles a ON a.id = c.article_id
    ORDER BY c.created_at DESC
    LIMIT 200
');
$comments = $stmt->fetchAll();

// ── Template ───────────────────────────────────────────────────────────

$pageTitle  = 'Comments — Admin';
$activePage = 'comments';
include __DIR__ . '/templates/header.php';
?>

<?php if ($message): ?>
    <div class="alert alert-<?= htmlspecialchars($messageType) ?> alert-dismissible fade show">
        <?= htmlspecialchars($message) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
<?php endif; ?>

<h2 class="mb-3">Latest Comments</h2>

<div class="table-responsive">
    <table class="table table-striped table-hover bg-white">
        <thead class="table-dark">
            <tr>
                <th>ID</th>
                <th>Author</th>
                <th>Comment</th>
                <th class="d-none d-md-table-cell">Post</th>
                <th class="d-none d-sm-table-cell">Date</th>
                <th class="text-end">Actions</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($comments)): ?>
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">No comments yet.</td>
                </tr>
            <?php endif; ?>
            <?php foreach ($comments as $comment): ?>
                <tr>
                    <td><?= (int) $comment['id'] ?></td>
                    <td><?= htmlspecialchars($comment['user_name'] ?? $comment['user_email'] ?? '—') ?></td>
                    <td style="max-width:400px;">
                        <?= htmlspecialchars(mb_strimwidth($comment['body'], 0, 120, '...')) ?>
                    </td>
                    <td class="d-none d-md-table-cell">
                        <?php if ($comment['article_title']): ?>
                            <span title="Post #<?= (int) $comment['article_id'] ?>">
                                <?= htmlspecialchars(mb_strimwidth($comment['article_title'], 0, 40, '...')) ?>
                            </span>
                        <?php else: ?>
                            <span class="text-muted">Deleted post</span>
                        <?php endif; ?>
                    </td>
                    <td class="d-none d-sm-table-cell">
                        <?= htmlspecialchars($comment['created_at']) ?>
                    </td>
                    <td class="text-end">
                        <form method="POST" class="d-inline"
                              onsubmit="return confirm('Delete this comment?');">
                            <?= csrfField() ?>
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id" value="<?= (int) $comment['id'] ?>">
                            <button type="submit" class="btn btn-sm btn-outline-danger">
                                <i class="bi bi-trash"></i><span class="d-none d-lg-inline"> Delete</span>
                            </button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php include __DIR__ . '/templates/footer.php'; ?>
