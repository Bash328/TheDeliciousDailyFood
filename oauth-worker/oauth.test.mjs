// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const env = { GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" };
const callback = (qs, cookie) =>
  worker.fetch(
    new Request(`https://relay.test/callback?${qs}`, { headers: cookie ? { Cookie: cookie } : {} }),
    env
  );

test("a callback with no state cookie is refused and never reaches GitHub", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail("must not call GitHub");
  try {
    const res = await callback("code=abc&state=xyz");
    assert.match(await res.text(), /state mismatch/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a state that differs from the cookie is refused", async () => {
  const res = await callback("code=abc&state=one", "dd_oauth_state=two");
  assert.match(await res.text(), /state mismatch/);
});

test("a good callback hands over the token and clears the cookie", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ access_token: "tok123" });
  try {
    const res = await callback("code=abc&state=same", "dd_oauth_state=same");
    assert.match(await res.text(), /tok123/);
    assert.match(res.headers.get("Set-Cookie"), /dd_oauth_state=;.*Max-Age=0/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a non-JSON reply from GitHub shows an error page, not a crash", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>outage</html>");
  try {
    const res = await callback("code=abc&state=same", "dd_oauth_state=same");
    assert.match(await res.text(), /no token returned/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
