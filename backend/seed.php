<?php

require_once __DIR__ . '/db.php';

$pdo = getDB();

$check = $pdo->query("SELECT COUNT(*) AS cnt FROM users WHERE email LIKE '%@example.com'");
if ($check->fetch()['cnt'] > 0) {
    echo "Seed data already exists. Skipping.\n";
    exit(0);
}

$password = password_hash('password123', PASSWORD_BCRYPT);

$users = [
    ['Edward Kelly',     'edward.kelly@example.com',     '-50 days'],
    ['Robert Tich',      'robert.tich@example.com',      '-45 days'],
    ['Franklin Strong',  'franklin.strong@example.com',  '-40 days'],
    ['Sophia Martinez',  'sophia.martinez@example.com',  '-35 days'],
    ['James Wilson',     'james.wilson@example.com',     '-30 days'],
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
