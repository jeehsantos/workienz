# Cloudflare Worker for Social Media OG Previews

This worker intercepts social media crawler requests and proxies them to the Supabase Edge Function for correct OG tags.

## Prerequisites

1. Domain `www.workie.co.nz` must use Cloudflare DNS (proxied, orange cloud)
2. Cloudflare Workers enabled on your account

## Setup Steps

### 1. Create a new Cloudflare Worker

Go to Cloudflare Dashboard → Workers & Pages → Create → Create Worker

Name it something like `workie-og-proxy`.

### 2. Paste this Worker code

```javascript
// Cloudflare Worker for www.workie.co.nz
// Intercepts social media crawlers and serves dynamic OG tags via Supabase Edge Function

// IMPORTANT: Use the PRODUCTION project URL, not the test/development one
// Production project ref: xzrlnezeuubdoqllvodi (Live environment)
// Test project ref: dkhcdzxelkkpxhmxazqi (Test environment - do NOT use in Worker)
const SUPABASE_EDGE_FUNCTION_URL = "https://xzrlnezeuubdoqllvodi.supabase.co/functions/v1/share-job";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cmxuZXpldXViZG9xbGx2b2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjEwNjAsImV4cCI6MjA4MjY5NzA2MH0.8W0wrJoVnwRYaL3pYKUolz1amDxxAU4mXZu--DqorY8";

// Social media crawler user agents (case-insensitive matching)
const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'facebot',
  'whatsapp',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'discordbot',
  'pinterest',
  'applebot',
  'redditbot',
  'skypeuripreview',
  'vkshare',
  'bot',
  'crawler',
  'spider',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(pattern => ua.includes(pattern));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

    // Only intercept /jobs/{uuid} paths
    const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/i);

    if (!jobMatch) {
      // Not a job URL — pass through to origin
      return fetch(request);
    }

    const isBot = isCrawler(userAgent);

    console.log(`[workie-og-proxy] path=${url.pathname} | UA=${userAgent} | isBot=${isBot}`);

    if (!isBot) {
      // Not a bot — pass through to origin (React SPA)
      const response = await fetch(request);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Worker-Status', 'passthrough');
      newResponse.headers.set('X-Bot-Detected', 'false');
      return newResponse;
    }

    // Bot detected — proxy to Edge Function
    const jobId = jobMatch[1];
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}?id=${encodeURIComponent(jobId)}`;

    try {
      const response = await fetch(edgeFunctionUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html',
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      console.log(`[workie-og-proxy] Edge Function status: ${response.status}`);

      if (response.ok) {
        const html = await response.text();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Worker-Status': 'proxied-to-edge-function',
            'X-Bot-Detected': 'true',
          },
        });
      }

      // If Edge Function fails, fall through to origin
      console.error(`[workie-og-proxy] Edge function returned status: ${response.status}`);
    } catch (error) {
      console.error(`[workie-og-proxy] Edge function fetch error:`, error);
    }

    // Fallback: serve the SPA
    const fallbackResponse = await fetch(request);
    const newFallback = new Response(fallbackResponse.body, fallbackResponse);
    newFallback.headers.set('X-Worker-Status', 'fallback-to-origin');
    newFallback.headers.set('X-Bot-Detected', 'true');
    return newFallback;
  },
};
```

### 3. Add Worker Routes (CRITICAL STEP)

Go to Cloudflare Dashboard → your domain (`workie.co.nz`) → Workers Routes → Add Route.

⚠️ **IMPORTANT:** Copy the route pattern exactly. No trailing quotes, spaces, or extra characters!

| Field   | Value                            |
|---------|----------------------------------|
| Route   | `www.workie.co.nz/jobs/*`        |
| Worker  | `workie-og-proxy`                |

Also add a second route for the non-www domain:

| Field   | Value                            |
|---------|----------------------------------|
| Route   | `workie.co.nz/jobs/*`            |
| Worker  | `workie-og-proxy`                |

**Common mistake:** The route must be exactly `www.workie.co.nz/jobs/*` — NOT `www.workie.co.nz/jobs/*"` (no trailing quote).

### 4. Verify DNS Configuration

In Cloudflare DNS settings for `workie.co.nz`:

- The DNS record for `www` (or root `@`) must be **proxied** (orange cloud ☁️ ON)
- If the orange cloud is off (DNS only / grey cloud), Workers won't execute

Example DNS records:
```
Type  | Name | Content              | Proxy
CNAME | www  | workienz.lovable.app | Proxied (orange)
```

### 5. Purge Cache After Changes

After updating the Worker code or routes:

1. Go to Cloudflare Dashboard → Caching → Configuration
2. Click "Purge Everything"
3. Wait 30 seconds before testing

---

## Testing Checklist

### Step 1: Test Edge Function Directly

This tests the Supabase Edge Function in isolation:

```bash
curl -s -A "facebookexternalhit/1.1" \
  "https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job?id=c0855e59-cb48-4c08-ad9c-d41ab888e8bf" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRraGNkenhlbGtrcHhobXhhenFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzYzODUsImV4cCI6MjA4NTg1MjM4NX0.IiArWt_cVlUW-P-9H3EedsK98MI7k3dM0N6F4lf3Qn8"
```

**Expected:** HTML with job-specific `og:title`, NO `<meta http-equiv="refresh">` tag.

### Step 2: Test Cloudflare Worker with Bot UA

```bash
curl -s -D - -A "facebookexternalhit/1.1" \
  "https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf"
```

**Expected:**
- `X-Worker-Status: proxied-to-edge-function`
- `X-Bot-Detected: true`
- HTML with job-specific `og:title`

### Step 3: Test Cloudflare Worker with Normal UA

```bash
curl -s -D - -A "Mozilla/5.0 (Macintosh)" \
  "https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf"
```

**Expected:**
- `X-Worker-Status: passthrough`
- `X-Bot-Detected: false`
- React SPA HTML

### Step 4: Facebook Sharing Debugger

1. Go to https://developers.facebook.com/tools/debug/
2. Enter: `https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf`
3. Click "Scrape Again"
4. Verify `og:title` shows the job-specific title

---

## Troubleshooting

### Facebook Debugger still shows generic OG tags

1. **Check Worker Route exists:** Dashboard → Workers Routes → verify `www.workie.co.nz/jobs/*` is listed with no trailing characters
2. **Check DNS is proxied:** The orange cloud must be ON for the domain
3. **Check Worker is deployed:** Go to Workers → your worker → verify it shows as deployed
4. **Check headers:** Run the curl test from Step 2 above. If you don't see `X-Worker-Status` headers, the Worker is not running
5. **Purge cache:** Cloudflare Dashboard → Caching → Purge Everything

### Worker is running but returning wrong content

- Make sure `apikey` header is included in the fetch to the Edge Function
- Supabase Edge Functions require the `apikey` header even when `verify_jwt = false`
- The anon key is safe to include in the Worker (it's a publishable key)

### WhatsApp preview not updating

WhatsApp caches link previews aggressively. To force a refresh:
1. Send the link in a new chat (not the same conversation)
2. Wait 5-10 minutes and try again
3. WhatsApp caches can last up to 24 hours

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│              www.workie.co.nz/jobs/{id}                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Is User-Agent a social media crawler?                    │    │
│  │ (facebookexternalhit, WhatsApp, Twitterbot, etc.)       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          │ YES                                  │ NO
          ▼                                      ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│ Supabase Edge Function  │          │ Lovable SPA Origin      │
│ /functions/v1/share-job │          │ (pass-through to        │
│                         │          │  origin server)         │
│ Returns:                │          │                         │
│ - Dynamic OG tags       │          │ Returns:                │
│ - Job-specific title    │          │ - React SPA             │
│ - Job location          │          │ - Client-side app       │
│ - NO redirect (for bot) │          │                         │
│ - Canonical URL         │          │                         │
└─────────────────────────┘          └─────────────────────────┘
```
