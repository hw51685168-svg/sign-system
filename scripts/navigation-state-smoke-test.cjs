const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const email = process.env.SMOKE_EMAIL || "gm@huangxiang.local";
const password = process.env.SMOKE_PASSWORD || "aaaa8888";

const jar = new Map();

function storeCookies(headers) {
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const item of setCookies) {
    const [pair] = item.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader() {
  return Array.from(jar.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : new URL(path, baseUrl).toString();
  const headers = new Headers(options.headers || {});
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...options, headers, redirect: "manual" });
  storeCookies(response.headers);
  return {
    status: response.status,
    location: response.headers.get("location"),
    text: await response.text()
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const csrfResponse = await request("/api/auth/csrf");
  assert(csrfResponse.status === 200, `csrf failed: ${csrfResponse.status}`);
  const csrfToken = JSON.parse(csrfResponse.text).csrfToken;

  const loginResponse = await request("/api/auth/callback/credentials", {
    method: "POST",
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: baseUrl,
      json: "true"
    }),
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }
  });
  assert(loginResponse.status === 200, `login failed: ${loginResponse.status}`);

  const home = await request("/");
  assert(home.status === 200, `home failed: ${home.status}`);
  assert(!home.text.includes('{"error"'), "home rendered api error text");

  const pending = await request("/approvals/progress?view=pending");
  assert(pending.status === 200, `pending approvals failed: ${pending.status}`);
  assert(!pending.text.includes('{"error"'), "pending approvals rendered api error text");

  const homeAgain = await request("/");
  assert(homeAgain.status === 200, `home again failed: ${homeAgain.status}`);

  const pendingAgain = await request("/approvals/progress?view=pending");
  assert(pendingAgain.status === 200, `pending approvals again failed: ${pendingAgain.status}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: ["/", "/approvals/progress?view=pending", "/", "/approvals/progress?view=pending"]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
