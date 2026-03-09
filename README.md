# Social Network

A full-stack social network application with article publishing, comments, likes, and an admin panel.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | PHP (built-in server), SQLite |
| **Auth (API)** | Bearer tokens (stored in DB, 24-hour lifetime) |
| **Auth (Admin)** | PHP sessions with CSRF protection |
| **Admin UI** | Bootstrap 5 |

---

## Project Structure

```
project/
├── backend/                  # PHP REST API + Admin panel
│   ├── index.php             # Main API router
│   ├── auth.php              # Auth logic (signup, login, logout, token validation)
│   ├── db.php                # SQLite connection + auto-migration
│   ├── seed.php              # Seed script (demo users + articles)
│   ├── database.sqlite       # SQLite database (auto-created)
│   ├── uploads/              # Uploaded images (admin panel)
│   └── admin/                # Admin panel (PHP + Bootstrap)
│       ├── login.php         # Admin login page
│       ├── logout.php        # Admin logout
│       ├── auth_check.php    # Session & CSRF helpers
│       ├── posts.php         # Article management (CRUD)
│       ├── comments.php      # Comment management
│       └── templates/        # Shared header/footer
├── frontend/                 # React SPA
│   └── src/
│       ├── api/              # API client + auth endpoints
│       ├── components/       # PostCard, forms, navigation
│       ├── context/          # AuthContext (global auth state)
│       ├── pages/            # HomePage, ArticlePage, LoginPage, etc.
│       └── CSS/              # Custom styles
├── core/                     # Legacy MySQL layer (not used by main app)
└── test/                     # Integration tests
    └── article-tests.mjs    # Article API test suite
```

---

## Installation & Launch

### Prerequisites

- **PHP 7.4+** with PDO SQLite extension
- **Node.js 16+** and npm (or pnpm)

### Step 1: Start the Backend

Open a terminal in the project root and run:

```bash
php -S localhost:8000 -t backend
```

The database file (`backend/database.sqlite`) is created automatically on first request. All tables are migrated automatically via `db.php`.

### Step 2: Seed Demo Data (optional but recommended)

In a separate terminal:

```bash
php backend/seed.php
```

This creates **6 demo users** and **8 sample articles**:

| User | Email | Password | Role |
|------|-------|----------|------|
| Edward Kelly | edward@example.com | password123 | user |
| Robert Tich | robert@example.com | password123 | user |
| Franklin Strong | franklin@example.com | password123 | user |
| Sophia Martinez | sophia@example.com | password123 | user |
| James Wilson | james@example.com | password123 | user |
| **Admin** | **admin@example.com** | **password123** | **admin** |

### Step 3: Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at **http://localhost:5173**. It automatically proxies all `/api` requests to `http://localhost:8000`.

### Summary

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Admin panel | http://localhost:8000/admin/login.php |

---

## How to Register

1. Open **http://localhost:5173** in your browser.
2. You will be redirected to the **Login** page (since you are not authenticated).
3. Click the **Sign Up** link at the bottom of the login form.
4. Fill in the registration form:
   - **Email** — must be a valid email format, unique across the system.
   - **Password** — minimum 8 characters, maximum 72 characters.
   - **Confirm Password** — must match the password field.
5. Click **Sign Up**.
6. On success, you are redirected to the **Login** page to sign in with your new account.

---

## How to Log In

1. Go to **http://localhost:5173/login**.
2. Enter your **email** and **password**.
3. Click **Log In**.
4. On success, you are redirected to the **Home** page (article feed).

Behind the scenes:
- The backend generates a random 64-character hex token, stores it in the database, and returns it to the frontend.
- The frontend saves the token in `localStorage` and attaches it as `Authorization: Bearer <token>` to every subsequent API request.
- Tokens expire after **24 hours**.
- Login is rate-limited: **5 attempts per IP address per 15 minutes**.

If you seeded the database, you can log in with any of the demo accounts (e.g., `edward@example.com` / `password123`).

---

## How to Create a Post (Article)

1. Log in and go to the **Home** page.
2. At the top of the feed, you will see the **Create Article** form with three fields:
   - **Title** (required) — the headline of your article.
   - **Body** (required) — the article content.
   - **Image URL** (optional) — a direct link to an image (must start with `http://` or `https://`).
3. Fill in the fields and click **Create**.
4. The new article appears at the top of the feed (articles are sorted newest-first).
5. Click on any article card to open its full page.

---

## How to Comment on a Post

1. Click on any article card in the feed to open the **Article Page**.
2. Scroll down to the **Comments** section.
3. Type your comment in the text area at the bottom.
4. Click **Send** (or the submit button).
5. Your comment appears immediately in the list below the article.

Each comment shows the author's name and creation date. Comments are loaded via `GET /api/articles/{id}/comments` and new ones are created via `POST /api/articles/{id}/comments`.

---

## How Likes Work

- Every article card on the Home page and the Article page has a **heart icon** (like button).
- Click the heart to **like** the article. The heart fills and the like count increments.
- Click it again to **unlike**. The heart unfills and the count decrements.
- Likes are a **toggle**: each `POST /api/articles/{id}/like` request checks if you already liked the article — if yes, it removes the like; if no, it adds one.
- The like count and your like status (`user_has_liked`) are included in every article response, so the UI always reflects the current state.
- Each user can like an article only once (enforced by a composite primary key on `user_id` + `article_id`).

---

## Admin Panel

### Accessing the Admin Panel

1. Go to **http://localhost:8000/admin/login.php** in your browser.
2. Log in with an admin account. If you seeded the database:
   - **Email:** `admin@example.com`
   - **Password:** `password123`
3. After login, you are redirected to the **Posts** management page.

### Post Management (posts.php)

The admin can perform full CRUD on articles:

- **View all posts** — a table listing every article with title, author, date, and action buttons.
- **Add a new post** — fill in title, body, and optionally upload an image file (JPEG, PNG, GIF, or WebP). Images are stored in `backend/uploads/`.
- **Edit a post** — change the title, body, or replace the image.
- **Delete a post** — removes the article and all its associated comments (cascade delete).

### Comment Management (comments.php)

- **View recent comments** — lists the latest 200 comments with article title, author, body, and date.
- **Delete a comment** — remove any inappropriate or spam comment.

### Security

- Admin pages are protected by PHP sessions. Only users with `role = 'admin'` can access them.
- All POST actions are protected by **CSRF tokens**.
- Image uploads are validated by MIME type (not just file extension).

---

## API Reference

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": "Error message"
}
```

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | No | Register a new user |
| POST | `/api/auth/login` | No | Log in, receive a token |
| POST | `/api/auth/logout` | Bearer | Invalidate the current token |
| GET | `/api/auth/me` | Bearer | Get current user info |

### Articles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/articles?page=1` | Bearer | Paginated list (5 per page, newest first) |
| GET | `/api/articles/{id}` | Bearer | Single article with like/comment counts |
| POST | `/api/articles` | Bearer | Create a new article |

### Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/articles/{id}/comments` | Bearer | List comments for an article |
| POST | `/api/articles/{id}/comments` | Bearer | Add a comment |

### Likes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/articles/{id}/like` | Bearer | Toggle like (returns `{ liked, like_count }`) |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Bearer | List all users |

---

## Database Schema

The SQLite database contains the following tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, name, email, password hash, avatar_url, bio, role, created_at) |
| `tokens` | Active auth tokens (user_id, token, created_at) |
| `articles` | Published articles (user_id, title, body, image_url, created_at) |
| `comments` | Article comments (article_id, user_id, body, created_at) |
| `likes` | Article likes (user_id + article_id composite PK) |
| `login_attempts` | Rate limiting (ip_address, attempted_at) |
| `messages` | Direct messages — schema exists, not yet implemented |
| `follows` | User follows — schema exists, not yet implemented |

---

## Running Tests

With the backend running on port 8000:

```bash
node test/article-tests.mjs
```

The test suite covers:

1. **Article creation** — valid/invalid inputs, auth requirements
2. **User attribution** — author ownership, cross-user visibility
3. **Pagination** — page navigation, 5 items per page, edge cases
4. **Security** — no password/token leakage, SQL injection, XSS prevention

---

## Design & UI

- **Dark theme** with background color `#081b29` and cyan accent `#0ef`.
- **Bottom navigation bar** with 5 tabs: Home, Search, Profile, Messenger, Settings.
- **Responsive layout** with media queries for smaller screens.
- Pages for Search, Profile, Messenger, and Settings use static/mock data (not connected to the API).

---

## Notes

- The `core/` directory contains a legacy MySQL database layer that is not used by the main application. The app runs entirely on SQLite.
- The frontend has Google/Facebook login buttons on the login page, but they are not functional (UI only).
- There is no logout button in the frontend UI, though the logout logic exists in `AuthContext`.
- The share button on article cards is visual only (not connected to any API).
