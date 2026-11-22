// Run with: npm test
// Uses Node's built-in SQLite behind a tiny stand-in for D1's API, so the real
// schema.sql and the real queries run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "./worker.js";

const ORIGIN = "https://site.test";

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { for (const s of list) await s.run(); },
  };
}

// Each test gets its own database and its own "inbox" (what would be emailed).
function setup() {
  const env = {
    DB: fakeD1(),
    ALLOWED_ORIGIN: ORIGIN,
    SITE_URL: ORIGIN,
    MAIL_FROM: "x <login@site.test>",
    RESEND_API_KEY: "k",
  };
  const inbox = [];
  globalThis.fetch = async (url, init) => {
    inbox.push(JSON.parse(init.body));
    return new Response("{}");
  };
  const call = (method, path, { body, cookie, origin = ORIGIN } = {}) =>
    worker.fetch(
      new Request("https://api.test" + path, {
        method,
        headers: {
          ...(origin ? { Origin: origin } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env
    );
  // Request a link, read it out of the "email", trade it for a session cookie.
  async function signIn(email = "cook@example.com") {
    await call("POST", "/auth/request", { body: { email } });
    const token = inbox.at(-1).text.match(/#token=([\w-]+)/)[1];
    const res = await call("POST", "/auth/verify", { body: { token } });
    return { token, res, cookie: res.headers.get("Set-Cookie")?.split(";")[0] };
  }
  return { env, inbox, call, signIn };
}

test("a sign-in link works once and then the session is recognised", async () => {
  const { call, signIn } = setup();
  const { token, res, cookie } = await signIn();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Set-Cookie"), /HttpOnly.*Secure/);
  assert.equal((await (await call("GET", "/me", { cookie })).json()).email, "cook@example.com");

  const again = await call("POST", "/auth/verify", { body: { token } });
  assert.equal(again.status, 400); // already used
});

test("signed-out requests are refused", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/me")).status, 401);
  assert.equal((await call("GET", "/saved")).status, 401);
  assert.equal((await call("GET", "/grocery")).status, 401);
});

test("a link that doesn't exist or is expired is refused", async () => {
  const { call, env, inbox } = setup();
  assert.equal((await call("POST", "/auth/verify", { body: { token: "nope" } })).status, 400);
  await call("POST", "/auth/request", { body: { email: "a@b.co" } });
  const token = inbox.at(-1).text.match(/#token=([\w-]+)/)[1];
  await env.DB.prepare("UPDATE login_tokens SET expires_at = 1").run();
  assert.equal((await call("POST", "/auth/verify", { body: { token } })).status, 400);
});

test("changing data from another site's page is refused", async () => {
  const { call, signIn } = setup();
  const { cookie } = await signIn();
  assert.equal((await call("PUT", "/saved/banana-bread", { cookie, origin: "https://evil.test" })).status, 403);
  assert.equal((await call("PUT", "/saved/banana-bread", { cookie, origin: null })).status, 403);
});

test("a bad email is refused, and an address can only be mailed 5 times an hour", async () => {
  const { call, inbox } = setup();
  assert.equal((await call("POST", "/auth/request", { body: { email: "not-an-email" } })).status, 400);
  for (let i = 0; i < 8; i++) {
    const res = await call("POST", "/auth/request", { body: { email: "victim@example.com" } });
    assert.equal(res.status, 200); // same answer every time
  }
  assert.equal(inbox.length, 5);
});

test("an account only exists after the link is used", async () => {
  const { call, env } = setup();
  await call("POST", "/auth/request", { body: { email: "stranger@example.com" } });
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first()).n, 0);
});

test("saving and un-saving recipes, and refusing junk slugs", async () => {
  const { call, signIn } = setup();
  const { cookie } = await signIn();
  await call("PUT", "/saved/banana-bread", { cookie });
  await call("PUT", "/saved/banana-bread", { cookie }); // twice is fine
  await call("PUT", "/saved/tuscan-chicken", { cookie });
  assert.deepEqual((await (await call("GET", "/saved", { cookie })).json()).slugs.sort(), ["banana-bread", "tuscan-chicken"]);
  await call("DELETE", "/saved/banana-bread", { cookie });
  assert.deepEqual((await (await call("GET", "/saved", { cookie })).json()).slugs, ["tuscan-chicken"]);
  assert.equal((await call("PUT", "/saved/..%2Fetc", { cookie })).status, 400);
  assert.equal((await call("PUT", "/saved/%E0%A4%A", { cookie })).status, 400);
});

test("each person sees only their own saved recipes and list", async () => {
  const { call, signIn } = setup();
  const a = await signIn("a@example.com");
  const b = await signIn("b@example.com");
  await call("PUT", "/saved/banana-bread", { cookie: a.cookie });
  await call("PUT", "/grocery", { cookie: a.cookie, body: { items: [{ text: "milk", checked: false }] } });
  assert.deepEqual((await (await call("GET", "/saved", { cookie: b.cookie })).json()).slugs, []);
  assert.equal((await (await call("GET", "/grocery", { cookie: b.cookie })).json()).items, null);
});

test("the grocery list round-trips and only keeps known fields", async () => {
  const { call, signIn } = setup();
  const { cookie } = await signIn();
  const put = await call("PUT", "/grocery", {
    cookie,
    body: { items: [{ text: "  milk ", checked: true, evil: "x" }, { text: "eggs" }] },
  });
  assert.equal(put.status, 200);
  assert.deepEqual((await (await call("GET", "/grocery", { cookie })).json()).items, [
    { text: "milk", checked: true },
    { text: "eggs", checked: false },
  ]);
  assert.equal((await call("PUT", "/grocery", { cookie, body: { items: [{ text: "" }] } })).status, 400);
  assert.equal((await call("PUT", "/grocery", { cookie, body: { items: "no" } })).status, 400);
});

test("deleting the account removes everything and ends the session", async () => {
  const { call, signIn, env } = setup();
  const { cookie } = await signIn();
  await call("PUT", "/saved/banana-bread", { cookie });
  await call("PUT", "/grocery", { cookie, body: { items: [{ text: "milk" }] } });
  assert.equal((await call("DELETE", "/me", { cookie })).status, 200);
  for (const table of ["users", "sessions", "saved", "grocery"]) {
    assert.equal((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n, 0, table);
  }
  assert.equal((await call("GET", "/me", { cookie })).status, 401);
});

test("signing out ends the session", async () => {
  const { call, signIn } = setup();
  const { cookie } = await signIn();
  await call("POST", "/auth/logout", { cookie });
  assert.equal((await call("GET", "/me", { cookie })).status, 401);
});
