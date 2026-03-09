const BASE = "http://localhost:8000";

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

// ── Helpers ──────────────────────────────────────────

async function post(endpoint, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function get(endpoint, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, { headers });
  const json = await res.json();
  return { status: res.status, ...json };
}

function assert(condition, testName) {
  if (condition) {
    totalPassed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    totalFailed++;
    failures.push(testName);
    console.log(`  ❌ FAIL: ${testName}`);
  }
}

// ── Setup: register two users and get tokens ─────────

const USERS = {
  alice: { email: "article-alice@gmail.com", password: "alicePass1" },
  bob:   { email: "article-bob@gmail.com",   password: "bobbyPass2" },
};

const tokens = {};

async function setup() {
  console.log("── Setup: creating test users ──\n");

  for (const [name, creds] of Object.entries(USERS)) {
    await post("/api/auth/signup", {
      email: creds.email,
      password: creds.password,
      confirm_password: creds.password,
    });
    const login = await post("/api/auth/login", creds);
    if (!login.data?.token) {
      console.error(`⛔ Could not log in as ${name}. Aborting.`);
      process.exit(1);
    }
    tokens[name] = login.data.token;
    console.log(`  Logged in as ${name} (${creds.email})`);
  }
  console.log("");
}

// ════════════════════════════════════════════════════════
//  1. ARTICLE CREATION TESTS
// ════════════════════════════════════════════════════════

async function creationTests() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       ARTICLE CREATION TEST SUITE            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Successful creation ────────────────────────────
  console.log("── Successful Creation ──");

  const r1 = await post("/api/articles", {
    title: "First Post by Alice",
    body: "This is the body of Alice's first post. It contains enough text to be meaningful.",
  }, tokens.alice);
  assert(r1.success === true && r1.status === 200, "Alice creates article");
  assert(typeof r1.data?.id === "number" && r1.data.id > 0, "Returns article id");
  assert(r1.data?.title === "First Post by Alice", "Returns correct title");
  assert(r1.data?.email === USERS.alice.email, "Returns author email");

  const r2 = await post("/api/articles", {
    title: "Bob's Article with Image",
    body: "Bob shares a travel photo from his latest adventure across Europe.",
    image_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600",
  }, tokens.bob);
  assert(r2.success === true, "Bob creates article with image");
  assert(r2.data?.image_url?.includes("unsplash"), "Image URL stored correctly");

  // ── Validation errors ──────────────────────────────
  console.log("\n── Validation ──");

  const noTitle = await post("/api/articles", { title: "", body: "Some body" }, tokens.alice);
  assert(noTitle.success === false && noTitle.status === 400, "Reject empty title");

  const noBody = await post("/api/articles", { title: "A title", body: "" }, tokens.alice);
  assert(noBody.success === false && noBody.status === 400, "Reject empty body");

  const emptyAll = await post("/api/articles", {}, tokens.alice);
  assert(emptyAll.success === false && emptyAll.status === 400, "Reject empty payload");

  const badImage = await post("/api/articles", {
    title: "Bad image",
    body: "Some body text here",
    image_url: "not-a-url",
  }, tokens.alice);
  assert(badImage.success === false && badImage.status === 400, "Reject invalid image URL");

  const ftpImage = await post("/api/articles", {
    title: "FTP image",
    body: "Some body text here",
    image_url: "ftp://files.example.com/image.jpg",
  }, tokens.alice);
  assert(ftpImage.success === false && ftpImage.status === 400, "Reject non-HTTP image URL");

  // ── Unauthenticated creation ───────────────────────
  console.log("\n── Unauthenticated ──");

  const noAuth = await post("/api/articles", {
    title: "Hacker Post",
    body: "Should not work",
  });
  assert(noAuth.success === false && noAuth.status === 401, "Reject article creation without token");

  const badAuth = await post("/api/articles", {
    title: "Hacker Post",
    body: "Should not work",
  }, "fake-token-12345");
  assert(badAuth.success === false && badAuth.status === 401, "Reject article creation with invalid token");
}

// ════════════════════════════════════════════════════════
//  2. USER ATTRIBUTION & DATABASE INTEGRITY
// ════════════════════════════════════════════════════════

async function attributionTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║      USER ATTRIBUTION & DB INTEGRITY         ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Create several articles with known authors
  const aliceArticles = [];
  for (let i = 1; i <= 3; i++) {
    const r = await post("/api/articles", {
      title: `Alice Attribution #${i}`,
      body: `Attribution test body ${i}. `.repeat(5),
    }, tokens.alice);
    if (r.success) aliceArticles.push(r.data);
  }

  const bobArticles = [];
  for (let i = 1; i <= 2; i++) {
    const r = await post("/api/articles", {
      title: `Bob Attribution #${i}`,
      body: `Bob's attribution test body ${i}. `.repeat(5),
    }, tokens.bob);
    if (r.success) bobArticles.push(r.data);
  }

  console.log("── Author Ownership ──");

  const allArticles = await get("/api/articles?page=1", tokens.alice);
  assert(allArticles.success === true, "Can fetch articles list");

  const articles = allArticles.data?.articles || [];

  const aliceFromList = articles.filter(a => a.email === USERS.alice.email);
  const bobFromList = articles.filter(a => a.email === USERS.bob.email);

  assert(aliceFromList.length > 0, "Alice's articles appear in listing");
  assert(bobFromList.length > 0, "Bob's articles appear in listing");

  for (const a of aliceFromList) {
    assert(a.email === USERS.alice.email, `Article "${a.title}" attributed to Alice`);
    assert(a.user_id !== undefined, `Article "${a.title}" has user_id`);
  }

  for (const a of bobFromList) {
    assert(a.email === USERS.bob.email, `Article "${a.title}" attributed to Bob`);
  }

  // ── Single article fetch shows correct author ──────
  console.log("\n── Single Article Fetch ──");

  if (aliceArticles.length > 0) {
    const single = await get(`/api/articles/${aliceArticles[0].id}`, tokens.alice);
    assert(single.success === true, "Fetch single article by ID");
    assert(single.data?.title === aliceArticles[0].title, "Single article returns correct title");
    assert(single.data?.body === aliceArticles[0].body, "Single article returns full body");
    assert(single.data?.email === USERS.alice.email, "Single article shows correct author");
  }

  const notFound = await get("/api/articles/999999", tokens.alice);
  assert(notFound.success === false && notFound.status === 404, "Non-existent article returns 404");

  const badId = await get("/api/articles/0", tokens.alice);
  assert(badId.success === false, "Article ID 0 rejected");

  // ── Bob can see Alice's articles and vice versa ────
  console.log("\n── Cross-User Visibility ──");

  if (aliceArticles.length > 0) {
    const bobSeesAlice = await get(`/api/articles/${aliceArticles[0].id}`, tokens.bob);
    assert(bobSeesAlice.success === true, "Bob can see Alice's article");
    assert(bobSeesAlice.data?.email === USERS.alice.email, "Alice is still shown as author when Bob reads it");
  }
}

// ════════════════════════════════════════════════════════
//  3. PAGINATION TESTS
// ════════════════════════════════════════════════════════

async function paginationTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║          PAGINATION TEST SUITE               ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Ensure we have enough articles (at least 7 already from prior tests)
  const page1 = await get("/api/articles?page=1", tokens.alice);
  assert(page1.success === true, "Page 1 loads");
  assert(Array.isArray(page1.data?.articles), "Page 1 returns articles array");
  assert(page1.data?.articles.length <= 5, `Page 1 has at most 5 articles (got ${page1.data?.articles.length})`);
  assert(typeof page1.data?.page === "number", "Response includes page number");
  assert(typeof page1.data?.total_pages === "number", "Response includes total_pages");
  assert(typeof page1.data?.total === "number", "Response includes total count");
  assert(page1.data?.page === 1, "Page number is 1");

  console.log(`  (Total articles: ${page1.data?.total}, total pages: ${page1.data?.total_pages})`);

  if (page1.data?.total_pages > 1) {
    const page2 = await get("/api/articles?page=2", tokens.alice);
    assert(page2.success === true, "Page 2 loads");
    assert(page2.data?.page === 2, "Page 2 reports correct page number");
    assert(page2.data?.articles.length > 0, "Page 2 has articles");
    assert(page2.data?.articles.length <= 5, `Page 2 has at most 5 articles (got ${page2.data?.articles.length})`);

    const page1Ids = new Set(page1.data.articles.map(a => a.id));
    const overlap = page2.data.articles.some(a => page1Ids.has(a.id));
    assert(!overlap, "Page 1 and page 2 have no overlapping articles");
  }

  // ── Edge cases ─────────────────────────────────────
  console.log("\n── Pagination Edge Cases ──");

  const pageZero = await get("/api/articles?page=0", tokens.alice);
  assert(pageZero.success === true && pageZero.data?.page === 1, "Page 0 defaults to page 1");

  const pageNeg = await get("/api/articles?page=-5", tokens.alice);
  assert(pageNeg.success === true && pageNeg.data?.page === 1, "Negative page defaults to page 1");

  const pageBig = await get("/api/articles?page=9999", tokens.alice);
  assert(pageBig.success === true, "Very large page number doesn't crash");
  assert(pageBig.data?.articles.length === 0, "Very large page returns empty articles");

  const pageStr = await get("/api/articles?page=abc", tokens.alice);
  assert(pageStr.success === true && pageStr.data?.page === 1, "Non-numeric page defaults to page 1");

  // ── Ordering ───────────────────────────────────────
  console.log("\n── Ordering ──");

  const ordered = await get("/api/articles?page=1", tokens.alice);
  const dates = ordered.data?.articles.map(a => new Date(a.created_at + "Z").getTime()) || [];
  const isSorted = dates.every((d, i) => i === 0 || d <= dates[i - 1]);
  assert(isSorted, "Articles ordered newest-first");
}

// ════════════════════════════════════════════════════════
//  4. SECURITY TESTS
// ════════════════════════════════════════════════════════

async function securityTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║           SECURITY TEST SUITE                ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── No password leakage ────────────────────────────
  console.log("── Data Leakage Prevention ──");

  const listRes = await get("/api/articles?page=1", tokens.alice);
  const listStr = JSON.stringify(listRes);
  assert(!listStr.includes("password"), "Article listing does not contain password field");
  assert(!listStr.includes(USERS.alice.password), "Article listing does not leak plaintext password");
  assert(!listStr.includes("$2y$") && !listStr.includes("$2b$"), "Article listing does not leak password hash");

  if (listRes.data?.articles?.length > 0) {
    const articleId = listRes.data.articles[0].id;
    const singleRes = await get(`/api/articles/${articleId}`, tokens.alice);
    const singleStr = JSON.stringify(singleRes);
    assert(!singleStr.includes("password"), "Single article does not contain password field");
    assert(!singleStr.includes("$2y$") && !singleStr.includes("$2b$"), "Single article does not leak password hash");
  }

  // ── Token field not exposed in articles ────────────
  assert(!listStr.includes(tokens.alice), "Article listing does not leak auth token");
  assert(!listStr.includes(tokens.bob), "Article listing does not leak other user's token");

  // ── Unauthenticated access blocked ─────────────────
  console.log("\n── Unauthenticated Access ──");

  const noAuthList = await get("/api/articles?page=1");
  assert(noAuthList.success === false && noAuthList.status === 401, "Article list requires authentication");

  const noAuthSingle = await get("/api/articles/1");
  assert(noAuthSingle.success === false && noAuthSingle.status === 401, "Single article requires authentication");

  // ── SQL Injection in articles ──────────────────────
  console.log("\n── SQL Injection in Article Creation ──");

  const sqliPayloads = [
    { label: "SQL in title", title: "'; DROP TABLE articles; --", body: "Normal body" },
    { label: "SQL in body", title: "Normal title", body: "'; DROP TABLE users; --" },
    { label: "UNION in title", title: "' UNION SELECT * FROM users --", body: "Normal body" },
    { label: "Boolean blind in title", title: "' AND 1=1 --", body: "Normal body" },
    { label: "Subquery in body", title: "Test", body: "' OR (SELECT password FROM users LIMIT 1) --" },
  ];

  for (const payload of sqliPayloads) {
    const r = await post("/api/articles", payload, tokens.alice);
    assert(r.status !== 500, `SQLi create - ${payload.label}: no server error (status=${r.status})`);
  }

  // Verify DB is still intact
  const afterSqli = await get("/api/articles?page=1", tokens.alice);
  assert(afterSqli.success === true, "DB intact after SQL injection attempts (articles still load)");

  const loginCheck = await post("/api/auth/login", USERS.alice);
  assert(loginCheck.success === true, "DB intact after SQL injection attempts (can still login)");
  tokens.alice = loginCheck.data.token;

  // ── SQL Injection in article ID ────────────────────
  console.log("\n── SQL Injection in Article ID ──");

  const sqliIdPayloads = [
    "/api/articles/1%20OR%201=1",
    "/api/articles/1;DROP%20TABLE%20articles",
    "/api/articles/1%20UNION%20SELECT%20*%20FROM%20users",
  ];

  for (const url of sqliIdPayloads) {
    const r = await get(url, tokens.alice);
    assert(r.status === 404 || r.status === 400, `SQLi ID - ${url}: rejected (status=${r.status})`);
  }

  // ── XSS Protection ────────────────────────────────
  console.log("\n── XSS Protection in Articles ──");

  const xssPayloads = [
    { label: "Script in title", title: "<script>alert('xss')</script>", body: "Normal body text" },
    { label: "Script in body", title: "Normal title", body: "<script>document.cookie</script>" },
    { label: "Img onerror in title", title: '<img src=x onerror=alert(1)>', body: "Normal body" },
    { label: "Event handler in body", title: "Test", body: '<div onmouseover="alert(1)">hover me</div>' },
    { label: "SVG onload", title: '<svg onload=alert(1)>', body: "Normal body" },
    { label: "JavaScript URI in image", title: "JS image", body: "Body", image_url: "javascript:alert(1)" },
  ];

  for (const payload of xssPayloads) {
    const r = await post("/api/articles", payload, tokens.alice);
    if (r.success && r.data) {
      const responseStr = JSON.stringify(r.data);
      const hasUnescapedTags =
        responseStr.includes("<script") ||
        responseStr.includes("<img ") ||
        responseStr.includes("<svg ") ||
        responseStr.includes("<div ");
      assert(
        !hasUnescapedTags,
        `XSS create - ${payload.label}: HTML tags escaped in response`
      );
    } else {
      assert(true, `XSS create - ${payload.label}: rejected (status=${r.status})`);
    }
  }

  // Verify XSS payloads are sanitized in listing too
  const xssArticles = await get("/api/articles?page=1", tokens.alice);
  const xssListStr = JSON.stringify(xssArticles.data);
  assert(
    !xssListStr.includes("<script>alert"),
    "No raw <script> tags in article listing after XSS attempts"
  );
}

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

async function main() {
  console.log("════════════════════════════════════════════════");
  console.log("  Article API Integration Test Suite");
  console.log("  Target: " + BASE);
  console.log("  Date: " + new Date().toISOString());
  console.log("════════════════════════════════════════════════\n");

  try {
    await setup();
    await creationTests();
    await attributionTests();
    await paginationTests();
    await securityTests();
  } catch (err) {
    console.error("\n⛔ FATAL ERROR:", err.message);
    process.exit(1);
  }

  console.log("\n════════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("════════════════════════════════════════════════");
  console.log(`  Total:  ${totalPassed + totalFailed}`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Rate:   ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log("\n  Failed tests:");
    for (const f of failures) {
      console.log(`    ❌ ${f}`);
    }
  }

  console.log("\n════════════════════════════════════════════════\n");
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
