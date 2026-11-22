// Accounts API for the public site: passwordless email sign-in, saved recipes,
// and a grocery list that follows you between devices.
//
// Deploy as its own Cloudflare Worker on api.thedeliciousdaily.com, with a D1
// database (schema.sql). Full walkthrough: ../docs/ACCOUNTS-SETUP.md
//
//   POST   /auth/request   { email, turnstileToken? }  emails a one-time link
//   POST   /auth/verify    { token }                    trades it for a session
//   POST   /auth/logout
//   GET    /me             DELETE /me   (deletes the account and its data)
//   GET    /saved          PUT|DELETE /saved/:slug
//   GET    /grocery        PUT /grocery  { items: [{ text, checked }] }
//
// Sign-in links carry the token in the URL *fragment* (#token=...), which
// browsers never send to a server, and the page trades it with a POST — so a
// mail scanner that "clicks" the link can't use it up.

const SESSION_COOKIE = "dd_session";
const TOKEN_TTL = 15 * 60; // seconds a sign-in link works
const SESSION_TTL = 30 * 24 * 3600;
const MAX_EMAILS_PER_HOUR = 5; // per address, so nobody can mail-bomb a stranger
const LIMITS = { saved: 500, groceryItems: 300, groceryText: 200, bodyBytes: 64 * 1024 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[A-Za-z0-9_-]{1,100}$/;

const now = () => Math.floor(Date.now() / 1000);

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(env, data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...cors(env),
      ...extra,
    },
  });
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cookie(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function readCookie(request) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

// Errors are thrown as ready-made Responses and caught once, in fetch().
async function readJson(request, env) {
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) throw json(env, { error: "too large" }, 413);
  try {
    const body = JSON.parse(text || "{}");
    if (body && typeof body === "object") return body;
  } catch {
    /* falls through */
  }
  throw json(env, { error: "invalid JSON" }, 400);
}

async function currentUser(request, env) {
  const token = readCookie(request);
  const user = token
    ? await env.DB.prepare(
        "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires_at > ?"
      )
        .bind(await sha256(token), now())
        .first()
    : null;
  if (!user) throw json(env, { error: "not signed in" }, 401);
  return user;
}

async function sendLoginEmail(env, to, link) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject: "Your sign-in link for The Delicious Daily",
      text:
        "Open this link to sign in. It works once and expires in 15 minutes:\n\n" +
        `${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`mail failed: ${res.status} ${await res.text()}`);
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured, skip the check
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip || "" }),
  });
  return !!(await res.json()).success;
}

async function requestLink(request, env) {
  const body = await readJson(request, env);
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    throw json(env, { error: "invalid email", message: "That doesn't look like an email address." }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  // Fails open if the binding is missing (an older deploy), like the submission worker.
  if (env.AUTH_RATE_LIMIT && typeof env.AUTH_RATE_LIMIT.limit === "function") {
    const { success } = await env.AUTH_RATE_LIMIT.limit({ key: ip });
    if (!success) {
      throw json(env, { error: "rate limited", message: "Too many tries — please wait a minute." }, 429);
    }
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    throw json(env, { error: "spam check failed", message: "The spam check didn't pass — please try again." }, 400);
  }

  const t = now();
  const sent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?")
    .bind(email, t - 3600)
    .first();
  // Over the cap: say "ok" anyway and send nothing, so the answer never reveals
  // anything about an address and a victim's inbox can't be flooded.
  if (sent.n < MAX_EMAILS_PER_HOUR) {
    const token = randomToken();
    await env.DB.prepare("INSERT INTO login_tokens (hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), email, t, t + TOKEN_TTL)
      .run();
    await sendLoginEmail(env, email, `${env.SITE_URL}/account/#token=${token}`);
  }

  // Housekeeping, so these tables don't grow forever.
  await env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(t).run();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t).run();
  return json(env, { ok: true });
}

async function verifyLink(request, env) {
  const body = await readJson(request, env);
  // One statement both checks and spends the token, so two tabs racing can't both win.
  const row = await env.DB.prepare("DELETE FROM login_tokens WHERE hash = ? AND expires_at > ? RETURNING email")
    .bind(await sha256(String(body.token || "")), now())
    .first();
  if (!row) {
    throw json(env, { error: "bad link", message: "That link has expired or was already used. Ask for a new one." }, 400);
  }

  await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(crypto.randomUUID(), row.email, now())
    .run();
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(row.email).first();

  const session = randomToken();
  await env.DB.prepare("INSERT INTO sessions (hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(session), user.id, now() + SESSION_TTL)
    .run();
  return json(env, { ok: true, email: row.email }, 200, { "Set-Cookie": cookie(session, SESSION_TTL) });
}

async function logout(request, env) {
  const token = readCookie(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE hash = ?").bind(await sha256(token)).run();
  return json(env, { ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}

async function deleteAccount(request, env) {
  const user = await currentUser(request, env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM saved WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM grocery WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return json(env, { ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}

async function savedRoutes(request, env, slug) {
  const user = await currentUser(request, env);
  if (request.method === "GET" && !slug) {
    const { results } = await env.DB.prepare("SELECT slug FROM saved WHERE user_id = ? ORDER BY created_at DESC")
      .bind(user.id)
      .all();
    return json(env, { slugs: results.map((r) => r.slug) });
  }
  if (!slug || !SLUG.test(slug)) throw json(env, { error: "invalid recipe" }, 400);

  if (request.method === "PUT") {
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM saved WHERE user_id = ?").bind(user.id).first();
    if (n >= LIMITS.saved) throw json(env, { error: "limit", message: "You've saved the maximum number of recipes." }, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO saved (user_id, slug, created_at) VALUES (?, ?, ?)")
      .bind(user.id, slug, now())
      .run();
  } else if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM saved WHERE user_id = ? AND slug = ?").bind(user.id, slug).run();
  } else {
    throw json(env, { error: "method not allowed" }, 405);
  }
  return json(env, { ok: true });
}

async function groceryRoutes(request, env) {
  const user = await currentUser(request, env);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT data FROM grocery WHERE user_id = ?").bind(user.id).first();
    return json(env, { items: row ? JSON.parse(row.data) : null });
  }
  if (request.method !== "PUT") throw json(env, { error: "method not allowed" }, 405);

  const { items } = await readJson(request, env);
  if (!Array.isArray(items) || items.length > LIMITS.groceryItems) {
    throw json(env, { error: "invalid list" }, 400);
  }
  // Rebuilt from known fields only, so nothing else a client sends is stored.
  const clean = [];
  for (const item of items) {
    const text = item && typeof item.text === "string" ? item.text.trim() : "";
    if (!text || text.length > LIMITS.groceryText) throw json(env, { error: "invalid list" }, 400);
    clean.push({ text, checked: item.checked === true });
  }
  await env.DB.prepare(
    "INSERT INTO grocery (user_id, data, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
  )
    .bind(user.id, JSON.stringify(clean), now())
    .run();
  return json(env, { ok: true });
}

async function route(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method;

  if (method === "POST" && pathname === "/auth/request") return requestLink(request, env);
  if (method === "POST" && pathname === "/auth/verify") return verifyLink(request, env);
  if (method === "POST" && pathname === "/auth/logout") return logout(request, env);
  if (pathname === "/me") {
    if (method === "GET") return json(env, { email: (await currentUser(request, env)).email });
    if (method === "DELETE") return deleteAccount(request, env);
  }
  if (pathname === "/saved" && method === "GET") return savedRoutes(request, env, null);
  if (pathname.startsWith("/saved/")) {
    let slug = "";
    try {
      slug = decodeURIComponent(pathname.slice("/saved/".length));
    } catch {
      /* stays empty, refused as an invalid recipe */
    }
    return savedRoutes(request, env, slug);
  }
  if (pathname === "/grocery") return groceryRoutes(request, env);
  return json(env, { error: "not found" }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    // CORS only stops other sites *reading* answers. This stops them *acting*:
    // anything that changes data must say it comes from our own pages.
    if (request.method !== "GET" && request.headers.get("Origin") !== env.ALLOWED_ORIGIN) {
      return json(env, { error: "origin not allowed" }, 403);
    }
    try {
      return await route(request, env);
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("api error:", err && err.stack ? err.stack : String(err));
      return json(env, { error: "internal error" }, 500);
    }
  },
};
