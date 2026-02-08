

# Fix Social Media OG Previews -- Complete Solution

## Problem Analysis

There are **two separate issues** preventing social media previews from showing job details:

### Issue A: Cloudflare Worker Not Intercepting Crawler Requests
The Facebook Debugger shows generic SPA metadata, proving the Worker is not running when Facebook's crawler visits `www.workie.co.nz/jobs/{id}`. The most likely cause is a **misconfigured Worker Route** -- the route appears to have a trailing quote character (`www.workie.co.nz/jobs/*"` instead of `www.workie.co.nz/jobs/*`).

### Issue B: Edge Function Has Redirect That Confuses Crawlers
Even if the Worker is fixed, the Edge Function currently includes:
- A `<meta http-equiv="refresh">` tag that causes crawlers to follow the redirect to the SPA (which has generic OG tags)
- An `og:url` with a `?p=1` query parameter (unnecessary)
- No `<link rel="canonical">` pointing to the job URL

Both issues must be fixed together.

---

## Solution

### Step 1: Update the Edge Function (code change)

Modify `supabase/functions/share-job/index.ts` to:

1. **Read the User-Agent header** from the incoming request and detect bots
2. **For bots (crawlers):** Return HTML with OG tags but **without** the `<meta http-equiv="refresh">` redirect tag. This prevents Facebook/WhatsApp crawlers from following the redirect to the SPA
3. **For regular browsers:** Keep the existing behavior with the redirect (so human users get forwarded to the real job page)
4. **Add `<link rel="canonical">`** pointing to the clean job URL in all responses
5. **Remove `?p=1`** from `og:url` -- use the clean canonical URL instead

The bot detection patterns will include: `facebookexternalhit`, `facebot`, `whatsapp`, `twitterbot`, `linkedinbot`, `slackbot`, `telegrambot`, `discordbot`, `pinterest`, `applebot`, `redditbot`, `skypeuripreview`, `vkshare`, `bot`, `crawler`, `spider`.

### Step 2: Update the Cloudflare Worker Documentation (code change)

Update `docs/cloudflare-worker-setup.md` with an improved Worker script that includes:

1. **Debug headers** (`X-Worker-Status`, `X-Bot-Detected`) so you can verify the Worker is running
2. **Explicit error logging** to help diagnose issues in Cloudflare Worker logs
3. **Clear route configuration instructions** -- emphasizing no trailing quotes or extra characters
4. **A test checklist** using `curl` commands to verify each layer independently

### Step 3: Verify Cloudflare Worker Route (manual step -- your action needed)

You will need to check and fix the Worker Route in Cloudflare Dashboard:

1. Go to Cloudflare Dashboard > workie.co.nz > Workers Routes
2. Delete the existing route if it has a trailing quote
3. Re-add the route as exactly: `www.workie.co.nz/jobs/*` (no trailing quote)
4. Also add: `workie.co.nz/jobs/*` for the non-www domain
5. Purge Cloudflare cache after the change

### Step 4: Keep ShareJob Component As-Is

The `ShareJob.tsx` component is already correct -- it uses the canonical `www.workie.co.nz` URL for all sharing actions. No changes needed here.

---

## How It Will Work After Fixes

```text
  Facebook/WhatsApp crawler requests www.workie.co.nz/jobs/{id}
                          |
                    Cloudflare Worker
                    (route: www.workie.co.nz/jobs/*)
                          |
                Is User-Agent a crawler?
                   /              \
                  YES              NO
                  |                 |
          Fetch Edge Function    Pass through
          /share-job?id={id}     to Lovable SPA
                  |                 |
          Edge Function          React app
          detects bot UA,        (normal user
          returns HTML with      experience)
          OG tags but NO
          redirect meta tag
                  |
          Facebook reads:
          og:title = "Cleaning house in Fairy Springs, Rotorua - Workie"
          og:image = workie.co.nz/social/og.png
          og:url = workie.co.nz/jobs/{id}
          canonical = workie.co.nz/jobs/{id}
```

---

## Technical Details

### Edge Function Changes (`supabase/functions/share-job/index.ts`)

- Add `isCrawler(userAgent)` function with comprehensive bot detection patterns
- Read `User-Agent` header from the request: `req.headers.get("user-agent")`
- Pass `isBot` flag to `generateHtml()` function
- In `generateHtml()`: conditionally include `<meta http-equiv="refresh">` only when `isBot` is `false`
- Add `<link rel="canonical" href="{jobUrl}">` to the HTML head
- Change `jobUrl` from `${WORKIE_DOMAIN}/jobs/${job.id}?p=1` to `${WORKIE_DOMAIN}/jobs/${job.id}` (remove `?p=1`)
- Add console logging for debugging: log the User-Agent and whether it was detected as a bot

### Cloudflare Worker Code Update (`docs/cloudflare-worker-setup.md`)

- Add `X-Worker-Status: proxied-to-edge-function` or `X-Worker-Status: passthrough` response headers
- Add `X-Bot-Detected: true/false` header
- Add explicit instructions to verify the route has no trailing characters
- Add `curl` testing commands for each step of the chain

### Manual Steps Required After Code Changes

1. Publish the project to deploy the updated Edge Function to Live
2. In Cloudflare Dashboard:
   - Delete the existing Worker Route (which may have a trailing quote)
   - Add route: `www.workie.co.nz/jobs/*` pointing to `workie-og-proxy`
   - Add route: `workie.co.nz/jobs/*` pointing to `workie-og-proxy`
   - Update the Worker code to match the new version from the docs
3. Purge Cloudflare cache (Cloudflare Dashboard > Caching > Purge Everything)
4. Test with Facebook Sharing Debugger: enter `https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf` and click "Scrape Again"

---

## Verification Commands

After deploying, test each layer:

```text
# 1. Test Edge Function directly (should show job-specific OG tags, no redirect for bot UA)
curl -s -A "facebookexternalhit/1.1" \
  "https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job?id=c0855e59-cb48-4c08-ad9c-d41ab888e8bf" \
  -H "apikey: <anon-key>"

# 2. Test Cloudflare Worker with bot UA (should return Edge Function HTML + debug headers)
curl -s -A "facebookexternalhit/1.1" \
  "https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf" \
  -D -

# 3. Test Cloudflare Worker with normal UA (should return React SPA)
curl -s -A "Mozilla/5.0" \
  "https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf" \
  -D -

# 4. Facebook Sharing Debugger
# https://developers.facebook.com/tools/debug/
```
