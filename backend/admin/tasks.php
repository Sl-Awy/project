<?php

// ── Auth & DB ──────────────────────────────────────────────────────────

require_once __DIR__ . '/auth_check.php';

$pdo = getDB();
$action      = $_GET['action'] ?? 'list';
$message     = '';
$messageType = '';

// ── Allowed values ─────────────────────────────────────────────────────

$URGENCIES   = ['low', 'medium', 'high', 'critical'];
$COMPLEXITIES = ['simple', 'moderate', 'complex'];
$SCOPES      = ['day', 'week'];
$STATUSES    = ['pending', 'in_progress', 'done'];

$STATUS_LABELS = [
    'pending'     => 'Pending',
    'in_progress' => 'In progress',
    'done'        => 'Done',
];

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
            $pdo->prepare('DELETE FROM tasks WHERE id = :id')->execute([':id' => $id]);
            $message     = 'Task deleted successfully.';
            $messageType = 'success';
        }
        $action = 'list';

    } elseif ($postAction === 'quick_update') {
        // Inline status / priority change straight from the list (feels real-time).
        $id       = (int) ($_POST['id'] ?? 0);
        $field    = $_POST['field'] ?? '';
        $value    = $_POST['value'] ?? '';
        $allowed  = ['urgency' => $URGENCIES, 'status' => $STATUSES];

        if ($id > 0 && isset($allowed[$field]) && in_array($value, $allowed[$field], true)) {
            $pdo->prepare("UPDATE tasks SET {$field} = :v WHERE id = :id")
                ->execute([':v' => $value, ':id' => $id]);
            $label       = $field === 'urgency' ? 'Priority' : 'Status';
            $message     = "{$label} updated.";
            $messageType = 'success';
        } else {
            $message     = 'Invalid update request.';
            $messageType = 'danger';
        }
        $action = 'list';

    } elseif ($postAction === 'add' || $postAction === 'edit') {
        $id          = (int) ($_POST['id'] ?? 0);
        $userId      = (int) ($_POST['user_id'] ?? 0);
        $title       = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $urgency     = $_POST['urgency'] ?? 'medium';
        $complexity  = $_POST['complexity'] ?? 'moderate';
        $scope       = $_POST['scope'] ?? 'day';
        $status      = $_POST['status'] ?? 'pending';
        $dueDate     = trim($_POST['due_date'] ?? '');

        // Validate the controlled vocabularies.
        if (!in_array($urgency, $URGENCIES, true))     $urgency = 'medium';
        if (!in_array($complexity, $COMPLEXITIES, true)) $complexity = 'moderate';
        if (!in_array($scope, $SCOPES, true))          $scope = 'day';
        if (!in_array($status, $STATUSES, true))       $status = 'pending';

        // Confirm the assignee exists.
        $assigneeOk = false;
        if ($userId > 0) {
            $chk = $pdo->prepare('SELECT id FROM users WHERE id = :id');
            $chk->execute([':id' => $userId]);
            $assigneeOk = (bool) $chk->fetch();
        }

        if ($title === '') {
            $message     = 'Title is required.';
            $messageType = 'danger';
            $action      = $postAction;
        } elseif (!$assigneeOk) {
            $message     = 'Please choose a valid employee to assign the task to.';
            $messageType = 'danger';
            $action      = $postAction;
        } else {
            $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $safeDesc  = $description === ''
                ? null
                : htmlspecialchars($description, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $dueValue  = $dueDate === '' ? null : $dueDate;

            if ($postAction === 'add') {
                $stmt = $pdo->prepare(
                    'INSERT INTO tasks (user_id, title, description, urgency, complexity, scope, status, due_date)
                     VALUES (:uid, :t, :d, :u, :c, :sc, :st, :due)'
                );
                $stmt->execute([
                    ':uid' => $userId,
                    ':t'   => $safeTitle,
                    ':d'   => $safeDesc,
                    ':u'   => $urgency,
                    ':c'   => $complexity,
                    ':sc'  => $scope,
                    ':st'  => $status,
                    ':due' => $dueValue,
                ]);
                $message     = 'Task created successfully.';
                $messageType = 'success';
            } else {
                $stmt = $pdo->prepare(
                    'UPDATE tasks
                     SET user_id = :uid, title = :t, description = :d, urgency = :u,
                         complexity = :c, scope = :sc, status = :st, due_date = :due
                     WHERE id = :id'
                );
                $stmt->execute([
                    ':uid' => $userId,
                    ':t'   => $safeTitle,
                    ':d'   => $safeDesc,
                    ':u'   => $urgency,
                    ':c'   => $complexity,
                    ':sc'  => $scope,
                    ':st'  => $status,
                    ':due' => $dueValue,
                    ':id'  => $id,
                ]);
                $message     = 'Task updated successfully.';
                $messageType = 'success';
            }
            $action = 'list';
        }
    }
}

// ── Load data ──────────────────────────────────────────────────────────

$users = $pdo->query('SELECT id, name, email FROM users ORDER BY name COLLATE NOCASE')->fetchAll();

$editTask = null;
if ($action === 'edit') {
    $editId = (int) ($_GET['id'] ?? $_POST['id'] ?? 0);
    if ($editId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $editId]);
        $editTask = $stmt->fetch();
    }
    if (!$editTask) {
        $message     = 'Task not found.';
        $messageType = 'danger';
        $action      = 'list';
    }
}

$tasks = [];
if ($action === 'list') {
    $stmt = $pdo->query("
        SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY
            CASE t.urgency
                WHEN 'critical' THEN 0
                WHEN 'high'     THEN 1
                WHEN 'medium'   THEN 2
                WHEN 'low'      THEN 3
                ELSE 4
            END,
            (t.due_date IS NULL), t.due_date ASC, t.created_at DESC
    ");
    $tasks = $stmt->fetchAll();
}

// ── Template ───────────────────────────────────────────────────────────

$pageTitle  = 'Task Management — Admin';
$activePage = 'tasks';
include __DIR__ . '/templates/header.php';
?>

<style>
    .badge.bg-orange { background-color: #fd7e14; }
    .quick-select { min-width: 130px; }
</style>

<?php if ($message): ?>
    <div class="alert alert-<?= htmlspecialchars($messageType) ?> alert-dismissible fade show">
        <?= htmlspecialchars($message) ?>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
<?php endif; ?>

<?php if ($action === 'list'): ?>

    <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>All Tasks</h2>
        <a href="tasks.php?action=add" class="btn btn-primary">
            <i class="bi bi-plus-lg"></i> Add Task
        </a>
    </div>

    <div class="table-responsive">
        <table class="table table-striped table-hover align-middle bg-white">
            <thead class="table-dark">
                <tr>
                    <th>ID</th>
                    <th>Task</th>
                    <th class="d-none d-md-table-cell">Assignee</th>
                    <th class="d-none d-lg-table-cell">Scope</th>
                    <th class="d-none d-lg-table-cell">Complexity</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($tasks)): ?>
                    <tr><td colspan="8" class="text-center text-muted py-4">No tasks yet.</td></tr>
                <?php endif; ?>
                <?php foreach ($tasks as $task): ?>
                    <tr>
                        <td><?= (int) $task['id'] ?></td>
                        <td style="max-width:280px;">
                            <div class="fw-semibold"><?= htmlspecialchars($task['title']) ?></div>
                            <?php if (!empty($task['description'])): ?>
                                <small class="text-muted">
                                    <?= htmlspecialchars(mb_strimwidth($task['description'], 0, 80, '...')) ?>
                                </small>
                            <?php endif; ?>
                            <?php if (!empty($task['due_date'])): ?>
                                <div><small class="text-muted">Due <?= htmlspecialchars($task['due_date']) ?></small></div>
                            <?php endif; ?>
                        </td>
                        <td class="d-none d-md-table-cell">
                            <?= htmlspecialchars($task['assignee_name'] ?? $task['assignee_email'] ?? '—') ?>
                        </td>
                        <td class="d-none d-lg-table-cell text-capitalize"><?= htmlspecialchars($task['scope']) ?></td>
                        <td class="d-none d-lg-table-cell text-capitalize"><?= htmlspecialchars($task['complexity']) ?></td>

                        <td>
                            <form method="POST" class="d-inline">
                                <?= csrfField() ?>
                                <input type="hidden" name="action" value="quick_update">
                                <input type="hidden" name="field" value="urgency">
                                <input type="hidden" name="id" value="<?= (int) $task['id'] ?>">
                                <select name="value" class="form-select form-select-sm quick-select"
                                        onchange="this.form.submit()">
                                    <?php foreach ($URGENCIES as $u): ?>
                                        <option value="<?= $u ?>" <?= $task['urgency'] === $u ? 'selected' : '' ?>>
                                            <?= ucfirst($u) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </form>
                        </td>

                        <td>
                            <form method="POST" class="d-inline">
                                <?= csrfField() ?>
                                <input type="hidden" name="action" value="quick_update">
                                <input type="hidden" name="field" value="status">
                                <input type="hidden" name="id" value="<?= (int) $task['id'] ?>">
                                <select name="value" class="form-select form-select-sm quick-select"
                                        onchange="this.form.submit()">
                                    <?php foreach ($STATUSES as $s): ?>
                                        <option value="<?= $s ?>" <?= $task['status'] === $s ? 'selected' : '' ?>>
                                            <?= htmlspecialchars($STATUS_LABELS[$s]) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </form>
                        </td>

                        <td class="text-end text-nowrap">
                            <a href="tasks.php?action=edit&id=<?= (int) $task['id'] ?>"
                               class="btn btn-sm btn-outline-primary mb-1">
                                <i class="bi bi-pencil"></i><span class="d-none d-lg-inline"> Edit</span>
                            </a>
                            <form method="POST" class="d-inline"
                                  onsubmit="return confirm('Delete this task?');">
                                <?= csrfField() ?>
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="id" value="<?= (int) $task['id'] ?>">
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
        <a href="tasks.php" class="btn btn-outline-secondary me-3">
            <i class="bi bi-arrow-left"></i> Back
        </a>
        <h2 class="mb-0"><?= $action === 'add' ? 'Add New Task' : 'Edit Task' ?></h2>
    </div>

    <?php
        $fTitle   = $editTask['title']       ?? $_POST['title']       ?? '';
        $fDesc    = $editTask['description'] ?? $_POST['description'] ?? '';
        $fUser    = (int) ($editTask['user_id'] ?? $_POST['user_id'] ?? 0);
        $fUrgency = $editTask['urgency']     ?? $_POST['urgency']     ?? 'medium';
        $fComplex = $editTask['complexity']  ?? $_POST['complexity']  ?? 'moderate';
        $fScope   = $editTask['scope']       ?? $_POST['scope']       ?? 'day';
        $fStatus  = $editTask['status']      ?? $_POST['status']      ?? 'pending';
        $fDue     = $editTask['due_date']    ?? $_POST['due_date']    ?? '';
        // due_date may be a full datetime; the date input needs YYYY-MM-DD.
        $fDueInput = $fDue ? substr($fDue, 0, 10) : '';
    ?>

    <div class="card shadow-sm">
        <div class="card-body">
            <form method="POST">
                <?= csrfField() ?>
                <input type="hidden" name="action" value="<?= htmlspecialchars($action) ?>">
                <?php if ($action === 'edit' && $editTask): ?>
                    <input type="hidden" name="id" value="<?= (int) $editTask['id'] ?>">
                <?php endif; ?>

                <div class="mb-3">
                    <label for="title" class="form-label">Title <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="title" name="title"
                           value="<?= htmlspecialchars($fTitle) ?>" required>
                </div>

                <div class="mb-3">
                    <label for="description" class="form-label">Description</label>
                    <textarea class="form-control" id="description" name="description"
                              rows="4"><?= htmlspecialchars($fDesc) ?></textarea>
                </div>

                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="user_id" class="form-label">Assign to <span class="text-danger">*</span></label>
                        <select class="form-select" id="user_id" name="user_id" required>
                            <option value="">— Select employee —</option>
                            <?php foreach ($users as $u): ?>
                                <option value="<?= (int) $u['id'] ?>" <?= $fUser === (int) $u['id'] ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($u['name'] ?? $u['email']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="col-md-6">
                        <label for="due_date" class="form-label">Due date</label>
                        <input type="date" class="form-control" id="due_date" name="due_date"
                               value="<?= htmlspecialchars($fDueInput) ?>">
                    </div>

                    <div class="col-md-6 col-lg-3">
                        <label for="urgency" class="form-label">Priority</label>
                        <select class="form-select" id="urgency" name="urgency">
                            <?php foreach ($URGENCIES as $u): ?>
                                <option value="<?= $u ?>" <?= $fUrgency === $u ? 'selected' : '' ?>><?= ucfirst($u) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="col-md-6 col-lg-3">
                        <label for="complexity" class="form-label">Complexity</label>
                        <select class="form-select" id="complexity" name="complexity">
                            <?php foreach ($COMPLEXITIES as $c): ?>
                                <option value="<?= $c ?>" <?= $fComplex === $c ? 'selected' : '' ?>><?= ucfirst($c) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="col-md-6 col-lg-3">
                        <label for="scope" class="form-label">Scope</label>
                        <select class="form-select" id="scope" name="scope">
                            <?php foreach ($SCOPES as $s): ?>
                                <option value="<?= $s ?>" <?= $fScope === $s ? 'selected' : '' ?>>
                                    <?= $s === 'day' ? 'Today' : 'This week' ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="col-md-6 col-lg-3">
                        <label for="status" class="form-label">Status</label>
                        <select class="form-select" id="status" name="status">
                            <?php foreach ($STATUSES as $s): ?>
                                <option value="<?= $s ?>" <?= $fStatus === $s ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($STATUS_LABELS[$s]) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="d-flex flex-wrap gap-2 mt-4">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-check-lg"></i>
                        <?= $action === 'add' ? 'Create Task' : 'Save Changes' ?>
                    </button>
                    <a href="tasks.php" class="btn btn-outline-secondary">Cancel</a>
                </div>
            </form>
        </div>
    </div>

<?php endif; ?>

<?php include __DIR__ . '/templates/footer.php'; ?>
