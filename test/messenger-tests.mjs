const BASE = "http://localhost:8000";

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

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
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, { headers });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function del(endpoint, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, { method: "DELETE", headers });
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

async function setup() {
  const suffix = Date.now();
  const alice = { email: `msg-alice-${suffix}@example.com`, password: "alicePass1!" };
  const bob = { email: `msg-bob-${suffix}@example.com`, password: "bobPass12!" };

  const aSign = await post("/api/auth/signup", {
    email: alice.email,
    password: alice.password,
    confirm_password: alice.password,
  });
  const bSign = await post("/api/auth/signup", {
    email: bob.email,
    password: bob.password,
    confirm_password: bob.password,
  });
  assert(aSign.success, "alice signup");
  assert(bSign.success, "bob signup");

  const aLogin = await post("/api/auth/login", alice);
  const bLogin = await post("/api/auth/login", bob);
  if (!aLogin.data?.token || !bLogin.data?.token) {
    console.error("Login failed", aLogin, bLogin);
    process.exit(1);
  }
  return { tokenA: aLogin.data.token, tokenB: bLogin.data.token, idA: aLogin.data.user.id, idB: bLogin.data.user.id };
}

async function run() {
  console.log("── Messenger & follow API tests ──\n");
  const { tokenA, tokenB, idA, idB } = await setup();

  const searchEmpty = await get("/api/users/search?q=", tokenA);
  assert(searchEmpty.status === 400, "empty search returns 400");

  const searchBob = await get(`/api/users/search?q=${encodeURIComponent("msg-bob")}`, tokenA);
  assert(
    searchBob.success && Array.isArray(searchBob.data) && searchBob.data.some((u) => u.id === idB),
    "search finds bob by email fragment"
  );
  const bobRow = searchBob.data.find((u) => u.id === idB);
  assert(bobRow && bobRow.is_following === false, "bob not followed yet");

  const follow = await post(`/api/users/${idB}/follow`, {}, tokenA);
  assert(follow.success && follow.data?.following === true, "alice can follow bob");

  const searchAgain = await get("/api/users/search?q=bob", tokenA);
  assert(
    searchAgain.data.find((u) => u.id === idB)?.is_following === true,
    "search shows is_following after follow"
  );

  const sendOk = await post(
    "/api/messenger/messages",
    { user_id: idB, body: "Hello Bob" },
    tokenA
  );
  assert(sendOk.success && sendOk.data?.body && sendOk.data.sender_id === idA, "alice can message bob after follow");

  const sendFail = await post(
    "/api/messenger/messages",
    { user_id: idA, body: "spam" },
    tokenB
  );
  assert(sendFail.status === 403, "bob cannot message alice without following");

  const msgsB = await get(`/api/messenger/messages?user_id=${idA}`, tokenB);
  assert(msgsB.success && msgsB.data?.length >= 1, "bob can read thread with alice (incoming)");

  const convA = await get("/api/messenger/conversations", tokenA);
  assert(
    convA.success && convA.data.some((c) => c.id === idB && c.last_message_body?.includes("Hello")),
    "conversations list includes bob with preview"
  );

  await post(`/api/users/${idA}/follow`, {}, tokenB);
  const sendBack = await post(
    "/api/messenger/messages",
    { user_id: idA, body: "Hi Alice" },
    tokenB
  );
  assert(sendBack.success, "bob can reply after following alice");

  await del(`/api/users/${idB}/follow`, tokenA);
  const sendAfterUnfollow = await post(
    "/api/messenger/messages",
    { user_id: idB, body: "nope" },
    tokenA
  );
  assert(sendAfterUnfollow.status === 403, "cannot send after unfollow");

  console.log(`\n── Done: ${totalPassed} passed, ${totalFailed} failed ──`);
  if (failures.length) {
    console.log("Failures:", failures);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
