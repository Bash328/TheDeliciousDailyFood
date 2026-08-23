// Decap CMS GitHub OAuth relay for a static (GitHub Pages) site.
//
// Deploy this file as a Cloudflare Worker, then set two secrets on it:
//   GITHUB_CLIENT_ID     — from your GitHub OAuth App
//   GITHUB_CLIENT_SECRET — from your GitHub OAuth App
//
// Paste the Worker's *.workers.dev URL into admin/config.yml as `base_url`,
// and use "<that url>/callback" as the OAuth App's Authorization callback URL.
//
// See docs/CMS-GUIDE.md for the full step-by-step setup.

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

function randomState() {
  return crypto.randomUUID();
}

async function handleAuth(url, env) {
  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("scope", "repo,user");
  authorizeUrl.searchParams.set("state", randomState());
  return Response.redirect(authorizeUrl.toString(), 302);
}

function renderCallbackPage(message) {
  const body = `<!DOCTYPE html><html><body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:${message.status}:${JSON.stringify(message.content)}',
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html" } });
}

async function handleCallback(url, env) {
  const code = url.searchParams.get("code");
  if (!code) {
    return renderCallbackPage({ status: "error", content: { error: "missing code" } });
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

  if (tokenData.error) {
    return renderCallbackPage({ status: "error", content: tokenData });
  }

  return renderCallbackPage({
    status: "success",
    content: { token: tokenData.access_token, provider: "github" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(url, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(url, env);
    }
    return new Response("Decap CMS GitHub OAuth relay. Use /auth to sign in.", {
      status: 200,
    });
  },
};
