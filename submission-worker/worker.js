// Public recipe submission handler for a static (GitHub Pages) site.
//
// Takes a submission from /submit-recipe/ and turns it into a pull request
// against the repo: a new draft file under _recipes/ on its own branch, with
// the submitter's raw pasted text and contact details in the PR description
// (never committed into the file itself). Nothing reaches the live site until
// that PR is reviewed and merged — and even then the file's `draft: true`
// keeps it off the homepage until that's unchecked in the CMS.
//
// Deploy as its own Cloudflare Worker, separate from the OAuth relay in
// ../oauth-worker (different job, different secret). Configuration:
//   GITHUB_TOKEN          — fine-grained PAT scoped to just this repo, with
//                           Contents: Read & write and Pull requests:
//                           Read & write. Set with `wrangler secret put`.
//   GITHUB_OWNER          — e.g. "Bash328"          (vars in wrangler.toml)
//   GITHUB_REPO           — e.g. "TheDeliciousDailyFood"
//   GITHUB_BRANCH         — base branch, defaults to "main"
//   ALLOWED_ORIGIN        — e.g. "https://thedeliciousdaily.com"
//   TURNSTILE_SECRET_KEY  — optional; leave unset to skip the spam check.
//
// Full walkthrough: ../docs/COLLABORATOR-AND-SUBMISSIONS-SETUP.md

import { validateSubmission } from "./validate.js";

const GITHUB_API = "https://api.github.com";
// Generous enough for a 1600px JPEG (the form shrinks photos before sending)
// plus the text, and small enough that nobody can push anything strange
// through this. Text-only submissions are a few KB.
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function slugify(title) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "recipe"
  );
}

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "delicious-daily-submission-worker",
  };
}

async function gh(env, path, options) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...ghHeaders(env), ...(options && options.headers) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

// The same call, but a 404 is an answer ("no such file") rather than a failure.
async function ghExists(env, path) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(env) });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status}`);
  return true;
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Front matter values are written as quoted YAML scalars, so whatever the
// submitter typed stays inert text instead of turning into YAML structure.
function yamlString(value) {
  return JSON.stringify(String(value == null ? "" : value));
}

function buildRecipeFile({ title, slug, category, description, imagePath }) {
  const date = new Date().toISOString().slice(0, 10);
  return [
    "---",
    `title: ${yamlString(title)}`,
    `slug: ${yamlString(slug)}`,
    `date: ${date}`,
    `category: ${yamlString(category)}`,
    `tag: ""`,
    `description: ${yamlString(description)}`,
    `image: ${yamlString(imagePath || "")}`,
    "recipeContent:",
    "  servingsUnit: Servings",
    "  ingredients: []",
    "  steps: []",
    `note: ""`,
    "draft: true",
    "---",
    "",
  ].join("\n");
}

// Whatever the form claims a photo is, this checks the actual leading bytes
// before anything gets committed — a file's magic number is the only part of
// it the sender can't just assert. Anything that isn't one of the three
// formats the site's image pipeline handles is refused outright.
const IMAGE_SIGNATURES = [
  { ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP is "RIFF" + 4 size bytes + "WEBP", so byte 8 onward is the tell.
  { ext: "webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

function base64Prefix(base64, byteCount) {
  // Four base64 characters carry three bytes, so this decodes just the head.
  const chunk = base64.slice(0, Math.ceil(byteCount / 3) * 4);
  let binary;
  try {
    binary = atob(chunk);
  } catch {
    return null;
  }
  return [...binary].map((c) => c.charCodeAt(0));
}

// Returns the file extension to use, or null if this isn't an image we accept.
function imageExtension(base64) {
  const head = base64Prefix(base64, 16);
  if (!head) return null;
  for (const sig of IMAGE_SIGNATURES) {
    const offset = sig.offset || 0;
    if (sig.bytes.every((b, i) => head[offset + i] === b)) return sig.ext;
  }
  return null;
}

// A code fence has to be longer than the longest run of backticks inside the
// text it wraps, or a submitter's own fence would close it early and let their
// text loose in the surrounding Markdown.
function fenceFor(text) {
  let longest = 0;
  for (const run of text.match(/`+/g) || []) {
    longest = Math.max(longest, run.length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured, skip the check
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip || "",
      }),
    }
  );
  const data = await res.json();
  return !!data.success;
}

// Turnstile stops bots that come through a browser, and only once it's been
// configured. This is the floor underneath it: a per-IP cap so nobody can sit
// in a loop opening pull requests, whether or not Turnstile is switched on.
// The binding is declared in wrangler.toml; if it's missing (an older deploy),
// submissions still work rather than failing shut.
async function withinRateLimit(request, env) {
  if (!env.SUBMIT_RATE_LIMIT || typeof env.SUBMIT_RATE_LIMIT.limit !== "function") {
    return true;
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await env.SUBMIT_RATE_LIMIT.limit({ key: ip });
  return success;
}

// CORS is enforced by browsers, not by us, so this doesn't stop a script with
// curl — nothing here can. What it does stop is somebody else's web page
// posting to this endpoint using their visitors' browsers. A request with no
// Origin header at all (curl, a health check) is left to the checks below.
function originAllowed(request, env) {
  if (!env.ALLOWED_ORIGIN) return true;
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === env.ALLOWED_ORIGIN;
}

async function handleSubmit(request, env) {
  if (!originAllowed(request, env)) {
    return json({ error: "origin not allowed" }, 403, env);
  }

  if (!(await withinRateLimit(request, env))) {
    return json(
      {
        error: "rate limited",
        message: "That's a few submissions in quick succession — please wait a minute and try again.",
      },
      429,
      env
    );
  }

  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return json(
      {
        error: "submission too large",
        message: "That submission is too large to send. Try a smaller photo.",
      },
      413,
      env
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400, env);
  }

  // Honeypot: if it's filled in, report success so a bot learns nothing from
  // the response, and do nothing at all.
  if (payload.website) {
    return json({ ok: true }, 200, env);
  }

  // Not truncated: validateSubmission below has the length limits, and a
  // recipe that's over them should be refused with an explanation rather than
  // quietly cut in half. The two contact fields aren't part of those rules, so
  // they're still capped here.
  const title = String(payload.title || "").trim();
  const category = String(payload.category || "").trim();
  const description = String(payload.description || "").trim();
  const raw = String(payload.raw || "").trim();
  const submitterName = String(payload.submitterName || "").trim().slice(0, 80);
  const submitterEmail = String(payload.submitterEmail || "").trim().slice(0, 120);

  // A photo is required, and it has to be an actual photo — the byte check
  // runs before the rest of the rules so "has an image" means "has one that
  // would really commit", not "sent something in the image field".
  let imageBase64 = null;
  let imageExt = null;
  if (payload.image && payload.image.data) {
    imageBase64 = String(payload.image.data).replace(/\s/g, "");
    if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
      return json(
        {
          error: "image too large",
          message: "That photo is too large. Please send a smaller one.",
        },
        413,
        env
      );
    }
    imageExt = imageExtension(imageBase64);
    if (!imageExt) {
      return json(
        {
          error: "unsupported image format",
          message: "That photo isn't a JPEG, PNG or WebP. Please send one of those.",
        },
        400,
        env
      );
    }
  }

  // The same rules the form applies before sending — enforced here too,
  // because anything can POST to this endpoint, form or not.
  const problem = validateSubmission({
    title,
    category,
    description,
    raw,
    hasImage: !!imageExt,
  });
  if (problem) {
    return json(
      { error: "invalid submission", field: problem.field, message: problem.message },
      400,
      env
    );
  }

  const verified = await verifyTurnstile(
    env,
    payload.turnstileToken,
    request.headers.get("CF-Connecting-IP")
  );
  if (!verified) {
    return json({ error: "spam check failed" }, 400, env);
  }

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const baseBranch = env.GITHUB_BRANCH || "main";

  const ref = await gh(env, `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
  const baseSha = ref.object.sha;

  // Two submissions of "Banana Bread" would otherwise write the same path, and
  // the second PUT would fail against the file already there — so a submission
  // whose slug is taken gets a suffix, on both the file and the recipe's URL.
  const stamp = Date.now().toString(36);
  let slug = slugify(title);
  const slugTaken = await ghExists(
    env,
    `/repos/${owner}/${repo}/contents/_recipes/${slug}.md?ref=${baseBranch}`
  );
  if (slugTaken) slug = `${slug}-${stamp}`;

  const branchName = `submission/${slug}-${stamp}`;
  const filePath = `_recipes/${slug}.md`;

  await gh(env, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
  });

  // The photo goes in first, under a name that says where it came from, so
  // the recipe file it's committed alongside can already point at it.
  let imagePath = "";
  if (imageBase64) {
    const imageFile = `images/submitted-${slug}-${stamp}.${imageExt}`;
    await gh(env, `/repos/${owner}/${repo}/contents/${imageFile}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Photo for recipe submission: ${title}`,
        content: imageBase64,
        branch: branchName,
      }),
    });
    // Leading slash: the shape the CMS's own image widget writes, and what
    // the site's imageUrl/imageSrc filters expect.
    imagePath = `/${imageFile}`;
  }

  await gh(env, `/repos/${owner}/${repo}/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Recipe submission: ${title}`,
      content: toBase64Utf8(
        buildRecipeFile({ title, slug, category, description, imagePath })
      ),
      branch: branchName,
    }),
  });

  const namePart = submitterName || "(no name given)";
  const emailPart = submitterEmail ? " <" + submitterEmail + ">" : "";
  const contact =
    submitterName || submitterEmail ? namePart + emailPart : "anonymous";
  const fence = fenceFor(raw);

  const prBody = [
    `**From:** ${contact}`,
    "",
    `**Category:** ${category}`,
    `**Description:** ${description}`,
    `**Photo:** ${imagePath ? "attached, see below" : "none sent"}`,
    "",
    "**Pasted recipe text** — copy this into the Quick Paste box on the",
    "Recipe content field in the CMS and click Parse & Fill:",
    "",
    fence,
    raw,
    fence,
    "",
    "",
    ...(imagePath
      ? [
          "**Photo sent with it** — already committed on this branch and",
          "already set as the recipe's photo, so merging brings it along. If",
          "you don't want it, delete the image from this branch and clear the",
          "`image:` line before merging.",
          "",
          `![Submitted photo](https://github.com/${owner}/${repo}/blob/${branchName}${imagePath}?raw=true)`,
          "",
        ]
      : []),
    "This file was created with `draft: true`, so merging it doesn't put it on",
    "the site. Uncheck that in the CMS once it's reviewed and ready to go live.",
  ].join("\n");

  const pr = await gh(env, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Recipe submission: ${title}`,
      head: branchName,
      base: baseBranch,
      body: prBody,
    }),
  });

  return json({ ok: true, pullRequestUrl: pr.html_url }, 200, env);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/submit") {
      try {
        return await handleSubmit(request, env);
      } catch (err) {
        // The detail stays in the worker's log rather than going back to the
        // browser — it can quote GitHub API responses.
        console.error(
          "submission failed:",
          err && err.stack ? err.stack : String(err)
        );
        return json({ error: "internal error" }, 500, env);
      }
    }
    return new Response(
      "Delicious Daily recipe submission worker. POST to /submit.",
      { status: 200, headers: corsHeaders(env) }
    );
  },
};
