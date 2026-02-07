# Cloudflare Worker for Social Media OG Previews

This worker intercepts social media crawler requests and proxies them to the Supabase Edge Function for correct OG tags.

## Prerequisites

1. Domain `www.workie.co.nz` must use Cloudflare DNS
2. Cloudflare Workers enabled on your account

## Setup Steps

### 1. Create a new Cloudflare Worker

Go to Cloudflare Dashboard → Workers → Create a Worker

### 2. Add this Worker code

```javascript
// Cloudflare Worker for www.workie.co.nz
// Intercepts social media crawlers and serves dynamic OG tags

const SUPABASE_EDGE_FUNCTION_URL = "https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job";
const LOVABLE_ORIGIN = "https://workienz.lovable.app";

// Social media crawler user agents
const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'meta-externalagent',
  'meta-externalfetcher',
  'WhatsApp',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'SkypeUriPreview',
  'Pinterest',
  'Googlebot',
  'bingbot'
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return CRAWLER_PATTERNS.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Check if this is a job page request from a crawler
    const jobMatch = url.pathname.match(/^\/jobs\/([a-f0-9-]+)$/i);
    
    if (jobMatch && isCrawler(userAgent)) {
      const jobId = jobMatch[1];
      
      // Proxy to Supabase Edge Function
      const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}?id=${jobId}`;
      
      try {
        const response = await fetch(edgeFunctionUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html',
          },
        });
        
        // Return the Edge Function response with correct content type
        const html = await response.text();
        return new Response(html, {
          status: response.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          },
        });
      } catch (error) {
        console.error('Edge function error:', error);
        // Fall through to serve the SPA
      }
    }
    
    // For all other requests, proxy to Lovable origin
    const newUrl = new URL(url.pathname + url.search, LOVABLE_ORIGIN);
    
    const response = await fetch(newUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return response;
  },
};
```

### 3. Configure Worker Route

Add a route trigger for `www.workie.co.nz/*`

### 4. Update DNS

Point your domain to Cloudflare:
- Remove the A record pointing to Lovable (185.158.133.1)
- Let Cloudflare proxy traffic through the Worker


### 5. Validate browser URL sharing

Use the normal browser URL (for example `https://www.workie.co.nz/jobs/{id}`) when sharing.
Social platforms should fetch that URL as a crawler and be routed by the Worker to `share-job` for OG tags.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    www.workie.co.nz/jobs/{id}                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Is User-Agent a social media crawler?                    │    │
│  │ (facebookexternalhit/meta-externalagent, WhatsApp, Twitterbot, etc.)       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          │ YES                                  │ NO
          ▼                                      ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│ Supabase Edge Function  │          │ Lovable SPA Origin      │
│ /functions/v1/share-job │          │ workienz.lovable.app    │
│                         │          │                         │
│ Returns:                │          │ Returns:                │
│ - Dynamic OG tags       │          │ - React SPA             │
│ - Job-specific title    │          │ - Client-side app       │
│ - 1-second redirect     │          │                         │
└─────────────────────────┘          └─────────────────────────┘
```

## Testing

1. Deploy the Worker
2. Use Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
3. Enter `https://www.workie.co.nz/jobs/{real-job-id}`
4. Verify `og:title` shows: "Job Title in Suburb, City - Workie"

## Alternative: Vercel Hosting

If you prefer not to use Cloudflare Workers, you can deploy to Vercel instead. The `vercel.json` and `api/share-job.ts` files are already configured for this.

Steps:
1. Connect your GitHub repo to Vercel
2. Deploy the project
3. Add `www.workie.co.nz` as a custom domain in Vercel
4. Update DNS to point to Vercel instead of Lovable

The Vercel approach uses the existing `vercel.json` rewrites to route crawlers to the API proxy.


## Troubleshooting (when debugger still shows homepage OG tags)

If Facebook Sharing Debugger still shows `https://www.workie.co.nz/` as canonical:

1. Ensure Worker routes include **both**:
   - `www.workie.co.nz/jobs/*`
   - `workie.co.nz/jobs/*`
2. Confirm DNS records for both root and `www` are orange-cloud proxied in Cloudflare.
3. Verify Worker is attached to the same zone serving `www.workie.co.nz`.
4. Test the worker path directly with the preview route: `https://www.workie.co.nz/s/jobs/{id}`.
   - This route bypasses crawler detection and always serves OG HTML from `share-job`.
5. In Facebook Debugger click **Scrape Again** after each config change (Facebook caches previous results).

