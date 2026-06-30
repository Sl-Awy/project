<?php

require_once __DIR__ . '/db.php';

$pdo = getDB();

$check = $pdo->query("SELECT COUNT(*) AS cnt FROM users WHERE email LIKE '%@example.com'");
$usersExist = $check->fetch()['cnt'] > 0;

if ($usersExist) {
    echo "Demo users already exist. Skipping user/article seed.\n";
    seedTasks($pdo);
    exit(0);
}

$password = password_hash('password123', PASSWORD_BCRYPT);

$users = [
    ['Edward Kelly',     'edward.kelly@example.com',     '-50 days'],
    ['Robert Tich',      'robert.tich@example.com',      '-45 days'],
    ['Franklin Strong',  'franklin.strong@example.com',  '-40 days'],
    ['Sophia Martinez',  'sophia.martinez@example.com',  '-35 days'],
    ['James Wilson',     'james.wilson@example.com',     '-30 days'],
    ['Admin',            'admin@example.com',            '-60 days'],
];

$insertUser = $pdo->prepare(
    'INSERT INTO users (name, email, password, created_at) VALUES (:name, :email, :pass, datetime("now", :offset))'
);

$userIds = [];
foreach ($users as $u) {
    $insertUser->execute([
        ':name'   => $u[0],
        ':email'  => $u[1],
        ':pass'   => $password,
        ':offset' => $u[2],
    ]);
    $userIds[$u[0]] = $pdo->lastInsertId();
    echo "  Created user: {$u[0]} ({$u[1]})\n";
}

$pdo->prepare("UPDATE users SET role = 'admin' WHERE id = :id")
    ->execute([':id' => $userIds['Admin']]);
echo "  Promoted Admin to admin role.\n";

$articles = [
    [
        'user'    => 'Edward Kelly',
        'title'   => 'Blockchain and Digital Security',
        'body'    => 'Implementation of blockchain technologies to store unchangeable data based on specific protocols is reshaping how we think about digital security. Decentralized ledgers offer tamper-proof records that can revolutionize industries from finance to healthcare. As adoption grows, we are witnessing a fundamental shift in how trust is established in digital systems.',
        'image'   => null,
        'offset'  => '-2 hours',
    ],
    [
        'user'    => 'Robert Tich',
        'title'   => 'Relaxing in the Maldives',
        'body'    => "It's very nice to relax in the Maldives! The crystal clear water and white sand beaches are absolutely breathtaking. Every morning I wake up to the sound of waves and the sight of an endless turquoise horizon. If you're looking for the perfect tropical getaway, this is the place to be.",
        'image'   => 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600',
        'offset'  => '-8 hours',
    ],
    [
        'user'    => 'Franklin Strong',
        'title'   => 'My First Visit to Paris',
        'body'    => 'I visited Paris for the first time in my life. The Eiffel Tower at sunset is something everyone should experience at least once. Walking along the Seine, visiting the Louvre, and tasting authentic French croissants made this trip truly unforgettable. Paris has a unique charm that photographs simply cannot capture.',
        'image'   => 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600',
        'offset'  => '-23 hours',
    ],
    [
        'user'    => 'Sophia Martinez',
        'title'   => 'React and TypeScript: A Perfect Match',
        'body'    => 'Just finished my latest web development project using React and TypeScript. The combination of type safety and component-based architecture makes development so much smoother. I used Tailwind CSS for styling, Vite for blazing-fast builds, and React Router for navigation. Highly recommend this stack for any modern web application.',
        'image'   => null,
        'offset'  => '-2 days',
    ],
    [
        'user'    => 'James Wilson',
        'title'   => 'Morning Hike in the Rocky Mountains',
        'body'    => 'Morning hike in the Rocky Mountains. Nothing beats fresh mountain air and stunning views to start your day right. The trail was challenging but the panoramic views from the summit were absolutely worth every step. I spotted some wildlife along the way, including a family of deer and a golden eagle soaring above.',
        'image'   => 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
        'offset'  => '-3 days',
    ],
    [
        'user'    => 'Edward Kelly',
        'title'   => 'The Future of Artificial Intelligence',
        'body'    => "Artificial intelligence is not just a trend — it's becoming an essential tool in every industry. From healthcare diagnostics to autonomous vehicles, AI is transforming the way we live and work. The question is no longer whether AI will change the world, but how quickly we can adapt to the changes it brings.",
        'image'   => null,
        'offset'  => '-4 days',
    ],
    [
        'user'    => 'Sophia Martinez',
        'title'   => 'Book Review: Clean Code',
        'body'    => "Currently reading 'Clean Code' by Robert C. Martin. Every developer should have this book on their shelf. Great insights about writing maintainable software. The chapters on meaningful names and functions alone are worth the price. It changed how I approach code reviews and has made me a much better developer overall.",
        'image'   => null,
        'offset'  => '-5 days',
    ],
    [
        'user'    => 'Robert Tich',
        'title'   => 'Adventures in Thai Cooking',
        'body'    => 'Tried cooking Thai green curry for the first time today. Turned out amazing! Sometimes the best adventures happen in your own kitchen. The secret is using fresh ingredients — lemongrass, galangal, and Thai basil make all the difference. I paired it with jasmine rice and a cold glass of Thai iced tea.',
        'image'   => null,
        'offset'  => '-6 days',
    ],
];

$insertArticle = $pdo->prepare(
    'INSERT INTO articles (user_id, title, body, image_url, created_at) VALUES (:uid, :title, :body, :image, datetime("now", :offset))'
);

foreach ($articles as $a) {
    $insertArticle->execute([
        ':uid'    => $userIds[$a['user']],
        ':title'  => $a['title'],
        ':body'   => $a['body'],
        ':image'  => $a['image'],
        ':offset' => $a['offset'],
    ]);
    echo "  Created article: \"{$a['title']}\" by {$a['user']}\n";
}

echo "\nSeeding complete: " . count($users) . " users, " . count($articles) . " articles.\n";

seedTasks($pdo);

/**
 * Seed four construction-crew tasks per demo account (idempotent).
 *
 * Tasks vary in scope (day / week), urgency (low → critical) and complexity
 * (simple → complex). Users are resolved by email so this works whether or not
 * the users/articles seed ran in the same invocation.
 */
function seedTasks(PDO $pdo): void
{
    // email => list of [title, description, urgency, complexity, scope, status, due "+N days"]
    $tasksByEmail = [
        'edward.kelly@example.com' => [
            ['Upload drone footage of the foundation pour', 'Capture and upload the morning drone pass over the north foundation pour to the project gallery.', 'high', 'moderate', 'day', 'in_progress', '+0 days'],
            ['Photograph rebar layout before inspection', 'Take wide and close-up photos of the rebar grid so the inspector can review remotely.', 'critical', 'simple', 'day', 'pending', '+0 days'],
            ['Edit weekly site progress reel', 'Cut the raw clips from this week into a 90-second progress reel for the client portal.', 'medium', 'complex', 'week', 'pending', '+4 days'],
            ['Archive last month\'s site media', 'Sort, tag and archive the previous month of photos and video into the company library.', 'low', 'moderate', 'week', 'pending', '+6 days'],
        ],
        'robert.tich@example.com' => [
            ['Document crane assembly with photos', 'Record each stage of the tower crane assembly for the safety file.', 'critical', 'moderate', 'day', 'pending', '+0 days'],
            ['Upload concrete delivery timestamps', 'Log and upload photos of each concrete truck arrival with delivery tickets.', 'medium', 'simple', 'day', 'in_progress', '+0 days'],
            ['Produce 360° walkthrough of level 2', 'Shoot and stitch a 360° walkthrough of the level 2 framing for the design team.', 'high', 'complex', 'week', 'pending', '+3 days'],
            ['Review subcontractor media submissions', 'Check that all subcontractors uploaded their daily progress photos this week.', 'low', 'moderate', 'week', 'pending', '+5 days'],
        ],
        'franklin.strong@example.com' => [
            ['Capture safety toolbox talk on video', 'Record the morning safety briefing and upload it for crew members who missed it.', 'high', 'simple', 'day', 'pending', '+0 days'],
            ['Photograph completed electrical rough-in', 'Document the electrical rough-in on floors 1–3 before drywall closes the walls.', 'critical', 'moderate', 'day', 'in_progress', '+0 days'],
            ['Compile incident-prevention photo report', 'Assemble a photo report of corrected hazards from this week for the safety officer.', 'medium', 'complex', 'week', 'pending', '+4 days'],
            ['Tag and caption gallery uploads', 'Add captions and location tags to this week\'s uploaded media for searchability.', 'low', 'simple', 'week', 'pending', '+6 days'],
        ],
        'sophia.martinez@example.com' => [
            ['Edit client update video', 'Trim and color-correct the client update video covering this week\'s milestones.', 'high', 'complex', 'day', 'in_progress', '+0 days'],
            ['Upload material delivery photos', 'Photograph and upload the steel and glazing deliveries received this morning.', 'medium', 'simple', 'day', 'pending', '+0 days'],
            ['Storyboard the monthly highlight film', 'Plan shots and structure for the monthly project highlight film.', 'medium', 'moderate', 'week', 'pending', '+5 days'],
            ['Back up raw 4K footage to cloud', 'Transfer all raw 4K footage from the site cameras to cloud storage.', 'critical', 'moderate', 'week', 'pending', '+2 days'],
        ],
        'james.wilson@example.com' => [
            ['Inspect and photograph scaffolding', 'Walk the east elevation scaffolding and upload photos flagging any defects.', 'critical', 'simple', 'day', 'pending', '+0 days'],
            ['Record time-lapse of facade install', 'Set up and verify the time-lapse camera for today\'s facade panel installation.', 'medium', 'moderate', 'day', 'in_progress', '+0 days'],
            ['Assemble weekly photo log for client', 'Collect the best site photos of the week into the shared client folder.', 'low', 'simple', 'week', 'pending', '+5 days'],
            ['Calibrate site survey camera rig', 'Recalibrate the survey camera rig and document the new settings.', 'high', 'complex', 'week', 'pending', '+3 days'],
        ],
        'admin@example.com' => [
            ['Review pending media approvals', 'Go through the queue of crew-submitted photos and videos awaiting approval.', 'high', 'moderate', 'day', 'in_progress', '+0 days'],
            ['Verify storage quota across projects', 'Check that no active project has exceeded its media storage quota today.', 'medium', 'simple', 'day', 'pending', '+0 days'],
            ['Audit department task assignments', 'Confirm every crew member has their tasks assigned correctly for the week.', 'critical', 'complex', 'week', 'pending', '+2 days'],
            ['Publish weekly company media digest', 'Curate and publish the company-wide weekly digest of project media.', 'low', 'moderate', 'week', 'pending', '+6 days'],
        ],
    ];

    $insertTask = $pdo->prepare(
        'INSERT INTO tasks (user_id, title, description, urgency, complexity, scope, status, due_date)
         VALUES (:uid, :title, :desc, :urgency, :complexity, :scope, :status, datetime("now", :due))'
    );
    $findUser = $pdo->prepare('SELECT id FROM users WHERE email = :email');
    $countTasks = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE user_id = :uid');

    $created = 0;
    $skipped = 0;
    foreach ($tasksByEmail as $email => $tasks) {
        $findUser->execute([':email' => $email]);
        $uid = $findUser->fetchColumn();
        if (!$uid) {
            echo "  Skipped tasks for {$email}: user not found.\n";
            continue;
        }

        $countTasks->execute([':uid' => $uid]);
        if ((int) $countTasks->fetchColumn() > 0) {
            $skipped++;
            continue;
        }

        foreach ($tasks as $t) {
            $insertTask->execute([
                ':uid'        => $uid,
                ':title'      => $t[0],
                ':desc'       => $t[1],
                ':urgency'    => $t[2],
                ':complexity' => $t[3],
                ':scope'      => $t[4],
                ':status'     => $t[5],
                ':due'        => $t[6],
            ]);
            $created++;
        }
        echo "  Created 4 tasks for {$email}\n";
    }

    if ($created === 0 && $skipped > 0) {
        echo "Tasks already exist for all demo accounts. Skipping task seed.\n";
    } else {
        echo "Task seeding complete: {$created} tasks created.\n";
    }
}
