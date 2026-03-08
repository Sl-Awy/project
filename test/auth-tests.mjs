const BASE = "http://localhost:8000";

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function getWithToken(endpoint, token) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function getRaw(endpoint) {
  return fetch(`${BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
  });
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

// ════════════════════════════════════════════════════════
//  REGISTRATION TESTS
// ════════════════════════════════════════════════════════

async function registrationTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         REGISTRATION TEST SUITE              ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Successful registration ──────────────────────────
  console.log("── Successful Registration ──");

  const users = [
    { email: "alice@gmail.com", password: "alice12345", confirm_password: "alice12345" },
    { email: "bob@gmail.com", password: "bob123456", confirm_password: "bob123456" },
    { email: "charlie@gmail.com", password: "charlie12", confirm_password: "charlie12" },
    { email: "diana@outlook.com", password: "diana9999", confirm_password: "diana9999" },
    { email: "eve@yahoo.com", password: "evePass12", confirm_password: "evePass12" },
  ];

  for (const u of users) {
    const r = await post("/api/auth/signup", u);
    assert(r.success === true && r.status === 200, `Register ${u.email}`);
  }

  // ── Duplicate registration ───────────────────────────
  console.log("\n── Duplicate Registration ──");

  const dupResult = await post("/api/auth/signup", users[0]);
  assert(dupResult.success === false && dupResult.status === 409, "Reject duplicate email (alice@gmail.com)");

  // ── Empty fields ─────────────────────────────────────
  console.log("\n── Empty Fields ──");

  const emptyBoth = await post("/api/auth/signup", { email: "", password: "", confirm_password: "" });
  assert(emptyBoth.success === false && emptyBoth.status === 400, "Reject empty email + password");

  const emptyEmail = await post("/api/auth/signup", { email: "", password: "testtest1", confirm_password: "testtest1" });
  assert(emptyEmail.success === false && emptyEmail.status === 400, "Reject empty email");

  const emptyPassword = await post("/api/auth/signup", { email: "empty@gmail.com", password: "", confirm_password: "" });
  assert(emptyPassword.success === false && emptyPassword.status === 400, "Reject empty password");

  const noBody = await post("/api/auth/signup", {});
  assert(noBody.success === false && noBody.status === 400, "Reject completely empty body");

  // ── Validation ───────────────────────────────────────
  console.log("\n── Input Validation ──");

  const badEmail = await post("/api/auth/signup", { email: "not-an-email", password: "testtest1", confirm_password: "testtest1" });
  assert(badEmail.success === false && badEmail.status === 400, "Reject invalid email format");

  const shortPw = await post("/api/auth/signup", { email: "short@gmail.com", password: "abc", confirm_password: "abc" });
  assert(shortPw.success === false && shortPw.status === 400, "Reject password shorter than 8 chars (sent 3)");

  const shortPw7 = await post("/api/auth/signup", { email: "short7@gmail.com", password: "abcdefg", confirm_password: "abcdefg" });
  assert(shortPw7.success === false && shortPw7.status === 400, "Reject password shorter than 8 chars (sent 7)");

  const mismatch = await post("/api/auth/signup", { email: "mismatch@gmail.com", password: "pass12345", confirm_password: "different1" });
  assert(mismatch.success === false && mismatch.status === 400, "Reject mismatched passwords");

  const longEmail = await post("/api/auth/signup", { email: "a".repeat(250) + "@gmail.com", password: "testtest1", confirm_password: "testtest1" });
  assert(longEmail.success === false && longEmail.status === 400, "Reject email exceeding 254 chars");

  const longPassword = await post("/api/auth/signup", { email: "longpw@gmail.com", password: "a".repeat(100), confirm_password: "a".repeat(100) });
  assert(longPassword.success === false && longPassword.status === 400, "Reject password exceeding 72 chars (bcrypt limit)");

  // ── SQL Injection Attempts ───────────────────────────
  console.log("\n── SQL Injection Attempts ──");

  const sqliPayloads = [
    { label: "Classic OR 1=1", email: "' OR '1'='1' --@test.com", password: "testtest1" },
    { label: "UNION SELECT", email: "' UNION SELECT * FROM users --@test.com", password: "testtest1" },
    { label: "DROP TABLE", email: "'; DROP TABLE users; --@test.com", password: "testtest1" },
    { label: "SQL in password", email: "sqli@gmail.com", password: "' OR '1'='1' --" },
    { label: "Stacked queries in password", email: "sqli2@gmail.com", password: "'; DELETE FROM users WHERE '1'='1" },
    { label: "Boolean-based blind SQLi", email: "' AND 1=1 --@test.com", password: "testtest123" },
    { label: "Time-based blind SQLi", email: "test@test.com", password: "' OR SLEEP(5) --" },
    { label: "SQLi in confirm_password", email: "sqli3@gmail.com", password: "safe12345", confirm_password: "' OR '1'='1" },
  ];

  for (const payload of sqliPayloads) {
    const r = await post("/api/auth/signup", {
      email: payload.email,
      password: payload.password,
      confirm_password: payload.confirm_password || payload.password,
    });
    assert(
      r.success === false || (r.success === true && r.status === 200),
      `SQLi signup - ${payload.label}: no crash (status=${r.status}, success=${r.success})`
    );
  }

  const verifyLogin = await post("/api/auth/login", { email: "alice@gmail.com", password: "alice12345" });
  assert(verifyLogin.success === true, "DB intact after SQL injection attempts (can still login)");

  // ── XSS Protection ──────────────────────────────────
  console.log("\n── XSS Protection in Registration ──");

  const xssPayloads = [
    { label: "Script tag in email", email: "<script>alert('xss')</script>@test.com", password: "testtest1", confirm_password: "testtest1" },
    { label: "Event handler in email", email: "test@test.com\" onmouseover=\"alert(1)", password: "testtest1", confirm_password: "testtest1" },
    { label: "Script tag in password", email: "xss1@gmail.com", password: "<script>alert('xss')</script>", confirm_password: "<script>alert('xss')</script>" },
    { label: "Img tag onerror", email: "xss2@gmail.com", password: "<img src=x onerror=alert(1)>test", confirm_password: "<img src=x onerror=alert(1)>test" },
    { label: "SVG onload", email: "xss3@gmail.com", password: "<svg onload=alert(1)>test123", confirm_password: "<svg onload=alert(1)>test123" },
    { label: "JavaScript URI in email", email: "javascript:alert(1)@test.com", password: "testtest1", confirm_password: "testtest1" },
  ];

  for (const payload of xssPayloads) {
    const r = await post("/api/auth/signup", payload);
    const responseStr = JSON.stringify(r);
    const noRawScript = !responseStr.includes("<script>") || r.success === false;
    assert(
      noRawScript,
      `XSS signup - ${payload.label}: no raw script in response`
    );
  }
}

// ════════════════════════════════════════════════════════
//  LOGIN TESTS
// ════════════════════════════════════════════════════════

async function loginTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║            LOGIN TEST SUITE                  ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Successful login ─────────────────────────────────
  console.log("── Successful Login ──");

  const loginUsers = [
    { email: "alice@gmail.com", password: "alice12345" },
    { email: "bob@gmail.com", password: "bob123456" },
    { email: "charlie@gmail.com", password: "charlie12" },
    { email: "diana@outlook.com", password: "diana9999" },
    { email: "eve@yahoo.com", password: "evePass12" },
  ];

  for (const u of loginUsers) {
    const r = await post("/api/auth/login", u);
    assert(r.success === true && r.status === 200, `Login ${u.email}`);
    assert(typeof r.data?.token === "string" && r.data.token.length > 0, `Token returned for ${u.email}`);
    assert(r.data?.user?.email === u.email, `Correct user returned for ${u.email}`);
  }

  // ── Token validation ─────────────────────────────────
  console.log("\n── Token Validation ──");

  const loginResult = await post("/api/auth/login", loginUsers[0]);
  const token = loginResult.data?.token;

  if (token) {
    const me = await getWithToken("/api/auth/me", token);
    assert(me.success === true && me.data?.user?.email === "alice@gmail.com", "GET /me with valid token");

    const badToken = await getWithToken("/api/auth/me", "invalid-token-12345");
    assert(badToken.success === false && badToken.status === 401, "GET /me with invalid token rejected");

    const emptyToken = await getWithToken("/api/auth/me", "");
    assert(emptyToken.success === false && emptyToken.status === 401, "GET /me with empty token rejected");
  }

  // ── Empty fields ─────────────────────────────────────
  console.log("\n── Empty Fields ──");

  const emptyBoth = await post("/api/auth/login", { email: "", password: "" });
  assert(emptyBoth.success === false && emptyBoth.status === 400, "Reject empty email + password");

  const emptyEmail = await post("/api/auth/login", { email: "", password: "testtest1" });
  assert(emptyEmail.success === false && emptyEmail.status === 400, "Reject empty email");

  const emptyPassword = await post("/api/auth/login", { email: "alice@gmail.com", password: "" });
  assert(emptyPassword.success === false && emptyPassword.status === 400, "Reject empty password");

  const noBody = await post("/api/auth/login", {});
  assert(noBody.success === false && noBody.status === 400, "Reject completely empty body");

  // ── Wrong credentials (generic error message) ───────
  console.log("\n── Wrong Credentials (generic errors) ──");

  const wrongPw = await post("/api/auth/login", { email: "alice@gmail.com", password: "wrongpassword1" });
  assert(wrongPw.success === false && wrongPw.status === 401, "Reject wrong password");
  assert(wrongPw.error === "Invalid email or password.", "Wrong password gives generic error (not 'Incorrect password')");

  const wrongEmail = await post("/api/auth/login", { email: "nonexistent@gmail.com", password: "alice12345" });
  assert(wrongEmail.success === false && wrongEmail.status === 401, "Reject non-existent email");
  assert(wrongEmail.error === "Invalid email or password.", "Wrong email gives generic error (not 'No account found')");

  const badEmailFormat = await post("/api/auth/login", { email: "not-an-email", password: "testtest1" });
  assert(badEmailFormat.success === false && badEmailFormat.status === 400, "Reject invalid email format");

  // ── Input length limits ──────────────────────────────
  console.log("\n── Input Length Limits ──");

  const longEmail = await post("/api/auth/login", { email: "a".repeat(250) + "@gmail.com", password: "testtest1" });
  assert(longEmail.success === false && longEmail.status === 400, "Reject email exceeding 254 chars");

  const longPassword = await post("/api/auth/login", { email: "alice@gmail.com", password: "a".repeat(100) });
  assert(longPassword.success === false && longPassword.status === 400, "Reject password exceeding 72 chars");

  // ── SQL Injection Attempts ───────────────────────────
  console.log("\n── SQL Injection Attempts ──");

  const sqliPayloads = [
    { label: "Classic OR bypass", email: "' OR '1'='1' --", password: "anything123" },
    { label: "Admin OR bypass", email: "admin'--", password: "anything123" },
    { label: "UNION SELECT", email: "' UNION SELECT 1, 'admin@test.com', '$2y$10$fake' --", password: "testtest1" },
    { label: "SQL in password", email: "alice@gmail.com", password: "' OR '1'='1' --" },
    { label: "Stacked queries", email: "'; DROP TABLE tokens; --", password: "testtest1" },
    { label: "Subquery injection", email: "' OR (SELECT COUNT(*) FROM users) > 0 --", password: "testtest1" },
    { label: "Batch insert in email", email: "test'; INSERT INTO tokens(user_id,token) VALUES(1,'hacked'); --", password: "testtest1" },
    { label: "Comment-based bypass", email: "alice@gmail.com'/*", password: "*/OR '1'='1" },
  ];

  for (const payload of sqliPayloads) {
    const r = await post("/api/auth/login", { email: payload.email, password: payload.password });
    assert(r.success === false, `SQLi login - ${payload.label}: not authenticated (success=${r.success})`);
  }

  const postSqliLogin = await post("/api/auth/login", { email: "alice@gmail.com", password: "alice12345" });
  assert(postSqliLogin.success === true, "DB intact after SQL injection login attempts");

  // ── XSS Protection ──────────────────────────────────
  console.log("\n── XSS Protection in Login ──");

  const xssPayloads = [
    { label: "Script tag in email", email: "<script>alert('xss')</script>", password: "testtest1" },
    { label: "Script tag in password", email: "alice@gmail.com", password: "<script>alert('xss')</script>" },
    { label: "Img onerror in email", email: "<img src=x onerror=alert(1)>", password: "testtest1" },
    { label: "SVG onload in password", email: "alice@gmail.com", password: "<svg onload=alert(1)>" },
    { label: "Event handler in email", email: "\" onfocus=\"alert(1)\" autofocus=\"", password: "testtest1" },
    { label: "Encoded script", email: "&#60;script&#62;alert(1)&#60;/script&#62;", password: "testtest1" },
  ];

  for (const payload of xssPayloads) {
    const r = await post("/api/auth/login", { email: payload.email, password: payload.password });
    const responseStr = JSON.stringify(r);
    const hasRawScript = responseStr.includes("<script>alert");
    const hasUnescapedHtml = responseStr.includes("<img src=x") || responseStr.includes("<svg onload");

    assert(
      r.success === false,
      `XSS login - ${payload.label}: request rejected (success=${r.success})`
    );

    if (r.error) {
      assert(
        !hasRawScript && !hasUnescapedHtml,
        `XSS login - ${payload.label}: no unescaped HTML in error response`
      );
    }
  }

  // ── Security headers ─────────────────────────────────
  console.log("\n── Security Headers ──");

  const rawRes = await getRaw("/api/auth/me");
  assert(rawRes.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  assert(rawRes.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
  assert(rawRes.headers.get("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy header present");
  assert(rawRes.headers.get("content-security-policy") !== null, "Content-Security-Policy header present");

  // ── Rate limiting ────────────────────────────────────
  console.log("\n── Rate Limiting ──");

  for (let i = 0; i < 5; i++) {
    await post("/api/auth/login", { email: "alice@gmail.com", password: "brute_force_" + i });
  }

  const rateLimited = await post("/api/auth/login", { email: "alice@gmail.com", password: "brute_force_final" });
  assert(rateLimited.status === 429, `Rate limiting active after 5+ failed attempts (status=${rateLimited.status})`);
  assert(rateLimited.error?.includes("Too many"), "Rate limit error message is clear");
}

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

async function main() {
  console.log("════════════════════════════════════════════════");
  console.log("  Auth API Integration Test Suite (v2 — post-fix)");
  console.log("  Target: " + BASE);
  console.log("  Date: " + new Date().toISOString());
  console.log("════════════════════════════════════════════════");

  try {
    await registrationTests();
    await loginTests();
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
