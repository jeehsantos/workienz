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

const SUPABASE_EDGE_FUNCTION_URL = "https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRraGNkenhlbGtrcHhobXhhenFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzYzODUsImV4cCI6MjA4NTg1MjM4NX0.IiArWt_cVlUW-P-9H3EedsK98MI7k3dM0N6F4lf3Qn8";

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

    // Only intercept /jobs/{uuid} paths for crawlers
    const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/i);

    if (jobMatch && isCrawler(userAgent)) {
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

        if (response.ok) {
          const html = await response.text();
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
        // If Edge Function fails, fall through to origin
        console.error('Edge function returned status:', response.status);
      } catch (error) {
        console.error('Edge function fetch error:', error);
        // Fall through to serve the SPA
      }
    }

    // For all other requests, pass through to origin (Lovable hosting)
    return fetch(request);
  },
};
```

### 3. Add a Worker Route (CRITICAL STEP)

Go to Cloudflare Dashboard → your domain (`workie.co.nz`) → Workers Routes → Add Route:

| Field   | Value                            |
|---------|----------------------------------|
| Route   | `www.workie.co.nz/jobs/*`        |
| Worker  | `workie-og-proxy`                |

**Important:** The route MUST be `www.workie.co.nz/jobs/*` (with `www`).

If your site also responds on `workie.co.nz` (no www), add a second route:
`workie.co.nz/jobs/*` → `workie-og-proxy`

### 4. Verify DNS Configuration

In Cloudflare DNS settings for `workie.co.nz`:

- The DNS record for `www` (or root `@`) must be **proxied** (orange cloud ☁️ ON)
- If the orange cloud is off (DNS only / grey cloud), Workers won't execute

Example DNS records:
```
Type  | Name | Content            | Proxy
CNAME | www  | workienz.lovable.app | Proxied (orange)
```

Or if using an A record:
```
Type | Name | Content        | Proxy
A    | www  | 185.158.133.1  | Proxied (orange)
```

### 5. Important: Worker Route vs. Worker Custom Domain

- **Worker Route** (recommended): Attach the worker to specific URL patterns on your existing domain
- **Worker Custom Domain**: NOT needed — use Routes instead

## Troubleshooting

### Facebook Debugger still shows generic OG tags

1. **Check Worker Route exists**: Dashboard → Workers Routes → verify `www.workie.co.nz/jobs/*` is listed
2. **Check DNS is proxied**: The orange cloud must be ON for the domain
3. **Check Worker is deployed**: Go to Workers → your worker → verify it shows as deployed
4. **Test the Edge Function directly**:
   ```
   curl "https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job?id=c0855e59-cb48-4c08-ad9c-d41ab888e8bf" \
     -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     -H "Accept: text/html"
   ```
5. **Test crawler detection**: Add `console.log` in the Worker:
   ```javascript
   console.log('UA:', userAgent, 'isCrawler:', isCrawler(userAgent), 'path:', url.pathname);
   ```
   Then check Workers → Logs → Begin log stream

### Worker is running but returning wrong content

- Make sure `apikey` header is included in the fetch to the Edge Function
- Supabase Edge Functions require the `apikey` header even when `verify_jwt = false`
- The anon key is safe to include in the Worker (it's a publishable key)

### WhatsApp preview not updating

WhatsApp caches link previews aggressively. To force a refresh:
1. Send the link in a new chat (not the same conversation)
2. Wait 5-10 minutes and try again
3. WhatsApp caches can last up to 24 hours

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
│ - 1-second redirect     │          │                         │
└─────────────────────────┘          └─────────────────────────┘
```

## Testing Checklist

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
   - Enter `https://www.workie.co.nz/jobs/{real-job-id}`
   - Click "Scrape Again"
   - Verify `og:title` shows: "Job Title in Suburb, City - Workie"

2. **WhatsApp**: Send the link to yourself
   - Preview should show job title and Workie branding

3. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
   - Enter job URL and verify card preview

4. **Direct curl test** (simulates Facebook crawler):
   ```bash
   curl -A "facebookexternalhit/1.1" "https://www.workie.co.nz/jobs/{job-id}"
   ```
   Should return HTML with job-specific OG tags, NOT the React SPA.
