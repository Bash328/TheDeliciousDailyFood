// Decap CMS GitHub OAuth relay for a static (GitHub Pages) site.
//
// Deploy this file as a Cloudflare Worker, then set two secrets on it:
//   GITHUB_CLIENT_ID     — from your GitHub OAuth App
//   GITHUB_CLIENT_SECRET — from your GitHub OAuth App
// and check ALLOWED_ORIGIN in wrangler.toml points at the site.
//
// Paste the Worker's *.workers.dev URL into admin/config.yml as `base_url`,
// and use "<that url>/callback" as the OAuth App's Authorization callback URL.
//
// See docs/CMS-GUIDE.md for the full step-by-step setup.

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const STATE_COOKIE = "dd_oauth_state";
const DEFAULT_ORIGIN = "https://thedeliciousdaily.com";

function allowedOrigin(env) {
  return (env && env.ALLOWED_ORIGIN) || DEFAULT_ORIGIN;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

// GitHub hands the state parameter back on the callback. Comparing it with a
// cookie set at the start of the flow is what stops someone from feeding this
// endpoint an authorization code obtained in a different browser — the usual
// OAuth CSRF. Without it the state value is decoration.
async function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  // Least privilege: this repo is public, and Decap only needs to read and
  // write its contents. `repo` would hand the token every private repository
  // the signed-in account can reach, and `user` isn't needed at all — the
  // /user call Decap makes works with no scope.
  authorizeUrl.searchParams.set("scope", "public_repo");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      // Lax rather than Strict: the callback arrives as a top-level navigation
      // from github.com, and Strict would withhold the cookie exactly then.
      "Set-Cookie": `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

function renderCallbackPage(message, env) {
  const origin = allowedOrigin(env);
  // Both of these are embedded in a <script>, so they go through JSON.stringify
  // and then have their forward slashes escaped — otherwise a "</script>"
  // appearing inside a value would end the block early.
  const payload = JSON.stringify(
    `authorization:github:${message.status}:${JSON.stringify(message.content)}`
  ).replace(/\//g, "\\/");
  const originLiteral = JSON.stringify(origin);

  const body = `<!DOCTYPE html><html><body>
<script>
(function () {
  var ALLOWED = ${originLiteral};
  var PAYLOAD = ${payload};
  function receiveMessage(e) {
    // Only ever hand the token back to the site itself. Posting to e.origin,
    // as the stock recipe does, means whichever window answered the handshake
    // receives it — including one opened by somebody else's page.
    if (e.origin !== ALLOWED) return;
    window.opener.postMessage(PAYLOAD, ALLOWED);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  if (window.opener) {
    window.opener.postMessage("authorizing:github", ALLOWED);
  }
})();
</script>
</body></html>`;
  return new Response(body, {
    headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
  });
}

async function handleCallback(request, url, env) {
  const code = url.searchParams.get("code");
  if (!code) {
    return renderCallbackPage(
      { status: "error", content: { error: "missing code" } },
      env
    );
  }

  const state = url.searchParams.get("state");
  const expected = readCookie(request, STATE_COOKIE);
  if (!state || !expected || state !== expected) {
    return renderCallbackPage(
      { status: "error", content: { error: "state mismatch, please try signing in again" } },
      env
    );
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error || !tokenData.access_token) {
    return renderCallbackPage(
      { status: "error", content: { error: tokenData.error || "no token returned" } },
      env
    );
  }

  return renderCallbackPage(
    {
      status: "success",
      content: { token: tokenData.access_token, provider: "github" },
    },
    env
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(url, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(request, url, env);
    }
    return new Response("Decap CMS GitHub OAuth relay. Use /auth to sign in.", {
      status: 200,
    });
  },
};
