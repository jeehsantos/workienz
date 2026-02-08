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
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cmxuZXpldXViZG9xbGx2b2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjEwNjAsImV4cCI6MjA4MjY5NzA2MH0.8W0wrJoVnwRYaL3pYKUolz1amDxxAU4mXZu--DqorY8";

// Social media crawler user agents (case-insensitive matching)
const CRAWLER_PATTERNS = [
  "facebookexternalhit",
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("User-Agent") || "";

    // Only intercept /jobs/{uuid} paths
    const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/i);

    if (!jobMatch) {
      // Not a job URL — pass through to origin
      return fetch(request);
    }

    const isBot = isCrawler(userAgent);

    console.log(
      `[workie-og-proxy] path=${url.pathname} | isBot=${isBot} | UA=${userAgent.substring(0, 80)}`
    );

    if (!isBot) {
      // Not a bot — pass through to origin (React SPA)
      const response = await fetch(request);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("X-Worker-Status", "passthrough");
      newResponse.headers.set("X-Bot-Detected", "false");
      return newResponse;
    }

    // Bot detected — proxy to Edge Function
    const jobId = jobMatch[1];
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
    const fallbackResponse = await fetch(request);
    const newFallback = new Response(fallbackResponse.body, fallbackResponse);
    newFallback.headers.set("X-Worker-Status", "fallback-to-origin");
    newFallback.headers.set("X-Bot-Detected", "true");
    return newFallback;
  },
};
