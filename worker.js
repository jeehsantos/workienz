// Cloudflare Worker for www.workie.co.nz
// Intercepts social media crawlers on /jobs/{uuid} and serves dynamic OG tags
// via Supabase Edge Function. All other traffic passes through to origin.
//
// DEPLOYMENT: This file is deployed via `npx wrangler deploy` using wrangler.toml
// ROUTING: Uses Worker Custom Domains (highest priority) to bypass SaaS routing conflicts

// IMPORTANT: Production project credentials (NOT test/development)
// Production project ref: xzrlnezeuubdoqllvodi
const SUPABASE_EDGE_FUNCTION_URL =
  "https://xzrlnezeuubdoqllvodi.supabase.co/functions/v1/share-job";
const PASS_THROUGH_ORIGIN = "workienz.lovable.app";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cmxuZXpldXViZG9xbGx2b2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjEwNjAsImV4cCI6MjA4MjY5NzA2MH0.8W0wrJoVnwRYaL3pYKUolz1amDxxAU4mXZu--DqorY8";

// Social media crawler user agents (case-insensitive matching)
const CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "meta-externalagent",
  "meta-externalfetcher",
  "facebot",
  "whatsapp",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
  "applebot",
  "redditbot",
  "skypeuripreview",
  "vkshare",
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern));
}

function extractJobId(pathname) {
  // Accept /jobs/{uuid} and /jobs/{uuid}/ to avoid missing crawler requests
  const jobMatch = pathname.match(/^\/jobs\/([a-f0-9-]{36})\/?$/i);
  return jobMatch ? jobMatch[1] : null;
}

function withWorkerHeaders(response, headers) {
  const newResponse = new Response(response.body, response);
  Object.entries(headers).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}

async function proxyToOrigin(request) {
  const passthroughUrl = new URL(request.url);
  passthroughUrl.protocol = "https:";
  passthroughUrl.hostname = PASS_THROUGH_ORIGIN;

  const originRequest = new Request(passthroughUrl.toString(), request);
  return fetch(originRequest);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("User-Agent") || "";

    const jobId = extractJobId(url.pathname);
    const isBot = isCrawler(userAgent);

    console.log(
      `[workie-og-proxy] path=${url.pathname} | jobId=${jobId || "none"} | isBot=${isBot} | UA=${userAgent.substring(0, 100)}`
    );

    if (!jobId) {
      // Not a job URL — pass through to origin but keep debug headers for verification.
      const response = await proxyToOrigin(request);
      return withWorkerHeaders(response, {
        "X-Worker-Status": "passthrough-non-job-path",
        "X-Bot-Detected": isBot ? "true" : "false",
        "X-Worker-Origin": PASS_THROUGH_ORIGIN,
      });
    }

    if (!isBot) {
      // Not a bot — pass through to origin (React SPA)
      const response = await proxyToOrigin(request);
      return withWorkerHeaders(response, {
        "X-Worker-Status": "passthrough",
        "X-Bot-Detected": "false",
        "X-Worker-Origin": PASS_THROUGH_ORIGIN,
      });
    }

    // Bot detected — proxy to Edge Function
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}?id=${encodeURIComponent(jobId)}`;

    try {
      const response = await fetch(edgeFunctionUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html",
          apikey: SUPABASE_ANON_KEY,
        },
      });

      console.log(
        `[workie-og-proxy] Edge Function status: ${response.status}`
      );

      if (response.ok) {
        const html = await response.text();
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "X-Worker-Status": "proxied-to-edge-function",
            "X-Bot-Detected": "true",
          },
        });
      }

      // If Edge Function fails, fall through to origin
      console.error(
        `[workie-og-proxy] Edge function returned status: ${response.status}`
      );
    } catch (error) {
      console.error(`[workie-og-proxy] Edge function fetch error:`, error);
    }

    // Fallback: serve the SPA
    const fallbackResponse = await proxyToOrigin(request);
    return withWorkerHeaders(fallbackResponse, {
      "X-Worker-Status": "fallback-to-origin",
      "X-Bot-Detected": "true",
      "X-Worker-Origin": PASS_THROUGH_ORIGIN,
    });
  },
};
