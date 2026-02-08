

# Fix Social Media OG Previews - Deploy the Edge Function

## Root Cause (Confirmed)

The `share-job` Edge Function is **not deployed**. Testing it directly returns:
```
404: {"code":"NOT_FOUND","message":"Requested function was not found"}
```

This single issue causes the entire chain to fail:
1. Cloudflare Worker detects Facebook crawler -- working correctly
2. Worker calls Edge Function -- gets 404 because function doesn't exist
3. Worker falls back to serving the React SPA HTML
4. Facebook reads the SPA's generic OG tags from `index.html` (`Workie | New Zealand's #1 Temporary Work Platform`)
5. Facebook follows the SPA's canonical URL (`https://www.workie.co.nz`) to the root page

The "infinite loop" visible in Screenshot 1 is the Workers.dev preview URL (`workie-og-proxy.alliance-noodlebox.workers.dev`), which has no origin server configured. This is expected behavior for the preview and does NOT affect production.

## What Needs to Happen

### Step 1: Deploy the Edge Function

Deploy `supabase/functions/share-job/index.ts` to both Test and Live environments. The function code is already correct:
- Bot detection via `isCrawler()` is properly implemented
- OG tags are dynamically generated with job title and location
- Redirect meta tag is suppressed for bots
- Canonical URL points to the correct job URL

### Step 2: Verify the Deployment

After deployment, test the function directly:
- Call the function with a Facebook crawler User-Agent
- Confirm it returns job-specific HTML with `og:title`, `og:description`, canonical URL
- Confirm no `<meta http-equiv="refresh">` tag for bot requests
- Confirm `X-Bot-Detected: true` header

### Step 3: Publish to Live

The Cloudflare Worker calls the **Live** Edge Function URL. The function must be published to Live for the production Worker to reach it.

## No Code Changes Needed

The Edge Function code (`supabase/functions/share-job/index.ts`) is already correct. The Cloudflare Worker code is already correct. The ShareJob component is already correct. The only action is deployment.

## After Deployment - Manual Steps

1. **Publish the project** to push the Edge Function to Live
2. **Purge Cloudflare cache** (Caching > Purge Everything)
3. **Test with Facebook Sharing Debugger**: Enter `https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf` and click "Scrape Again"

## About the Worker "Loop" (Screenshot 1)

The repeated GET requests visible in the Workers preview panel are caused by accessing the Worker via its `.workers.dev` URL directly. This URL has no origin server — the Worker is designed to run on `www.workie.co.nz` where it can pass through to the Lovable origin. Accessing it directly via `workie-og-proxy.alliance-noodlebox.workers.dev` causes it to fail repeatedly since there is no origin to fetch from. This is not a bug and does not affect production.

## Expected Results After Fix

Edge Function test (direct):
- Status: 200
- og:title: "Cleaning house in Fairy Springs, Rotorua - Workie"
- canonical: `https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf`
- No redirect meta tag for bot User-Agents

Cloudflare Worker test (with bot UA):
- X-Worker-Status: proxied-to-edge-function
- X-Bot-Detected: true
- Job-specific OG tags in HTML

Facebook Sharing Debugger:
- og:title: "Cleaning house in Fairy Springs, Rotorua - Workie"
- og:image: `https://www.workie.co.nz/social/og.png`
- Correct link preview with job details
