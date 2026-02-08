# Cloudflare Worker for Social Media OG Previews

This Worker intercepts social media crawler requests on `www.workie.co.nz/jobs/{id}` and proxies them to the Supabase Edge Function for correct OG tags. All other traffic passes through to the origin (Lovable SPA).

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│              www.workie.co.nz/jobs/{id}                    │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Custom Domain)             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Is User-Agent a social media crawler?               │  │
│  │ (facebookexternalhit, WhatsApp, Twitterbot, etc.)   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
         │ YES                              │ NO
         ▼                                  ▼
┌────────────────────────┐      ┌────────────────────────┐
│ Supabase Edge Function │      │ Origin (Lovable SPA)   │
│ /functions/v1/share-job│      │ React app via CNAME    │
│                        │      │                        │
│ Returns:               │      │ Returns:               │
│ - Dynamic OG tags      │      │ - React SPA            │
│ - Job-specific title   │      │ - Client-side app      │
│ - NO redirect (for bot)│      │                        │
│ - Canonical URL        │      │                        │
└────────────────────────┘      └────────────────────────┘
```

## Why Custom Domains (Not Worker Routes)

The domain `www.workie.co.nz` CNAMEs to `workienz.lovable.app`, which is hosted on Cloudflare's infrastructure. This creates a "Cloudflare-to-Cloudflare" (orange-to-orange) proxy situation where **Lovable's SaaS routing silently takes priority over Worker Routes**.

Cloudflare's request processing order:
```
1. Worker Custom Domains  ← highest priority (what we use)
2. Page Rules / Redirect Rules
3. Worker Routes           ← blocked by SaaS routing
4. SaaS routing (Lovable)  ← wins over Worker Routes
```

Worker Custom Domains bind the domain directly to the Worker at the DNS level, bypassing the SaaS routing conflict entirely.

## Prerequisites

1. Domain `www.workie.co.nz` must use Cloudflare DNS (proxied, orange cloud)
2. Cloudflare Workers enabled on your account
3. Git repository connected to Cloudflare for automated deployment

## Repository Files

| File | Purpose |
|------|---------|
| `wrangler.toml` | Worker deployment configuration |
| `worker.js` | Worker source code (production credentials) |

## Setup Steps

### 1. Cloudflare Build Settings

In Cloudflare Dashboard → Workers & Pages → `workie-og-proxy` → Settings → Build:

| Setting | Value |
|---------|-------|
| Build command | `echo skip` (or leave empty) |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| Production branch | `og-implementation` |

> **Note:** The build command must NOT be `bun run build` — that runs Vite, which is irrelevant for the Worker.

### 2. Add Custom Domain (Critical Step)

In Cloudflare Dashboard → Workers & Pages → `workie-og-proxy` → Settings → Domains and Routes:

1. Click **+ Add** → Select **Custom Domain**
2. Add: `www.workie.co.nz`
3. Cloudflare will show a confirmation — accept it
4. Optionally add `workie.co.nz` for non-www

> **After adding Custom Domains**, you can remove the old Worker Routes (`workie.co.nz/jobs/*` and `www.workie.co.nz/jobs/*`) since the Custom Domain handles all traffic and the Worker code filters by path internally.

### 3. Deploy

1. Merge `main` into the `og-implementation` branch (or create it from main)
2. Push to `og-implementation` — triggers Cloudflare's automatic build and deploy
3. Cloudflare runs `npx wrangler deploy` which reads `wrangler.toml` and deploys `worker.js`

### 4. Verify DNS

In Cloudflare DNS settings for `workie.co.nz`:

- The DNS record for `www` must be **proxied** (orange cloud ☁️ ON)
- If the orange cloud is off (DNS only / grey cloud), Workers won't execute

Example DNS record:
```
Type  | Name | Content              | Proxy
CNAME | www  | workienz.lovable.app | Proxied (orange)
```

---

## Testing

### Test 1: Edge Function Directly

```bash
curl -s -A "facebookexternalhit/1.1" \
  "https://xzrlnezeuubdoqllvodi.supabase.co/functions/v1/share-job?id=JOB_UUID_HERE" \
  -H "apikey: YOUR_PRODUCTION_ANON_KEY"
```

Expected: HTML with job-specific `og:title`, NO `<meta http-equiv="refresh">` tag.

### Test 2: Worker with Bot UA (PowerShell)

```powershell
$response = Invoke-WebRequest -Headers @{ "User-Agent"="facebookexternalhit/1.1" } "https://www.workie.co.nz/jobs/JOB_UUID_HERE"
$response.Headers["X-Worker-Status"]
$response.Content | Select-String "og:title"
```

Expected:
- `X-Worker-Status: proxied-to-edge-function`
- `X-Bot-Detected: true`
- HTML with job-specific `og:title`

### Test 3: Worker with Normal UA (PowerShell)

```powershell
$response = Invoke-WebRequest -Headers @{ "User-Agent"="Mozilla/5.0 (Windows)" } "https://www.workie.co.nz/jobs/JOB_UUID_HERE"
$response.Headers["X-Worker-Status"]
```

Expected:
- `X-Worker-Status: passthrough`
- `X-Bot-Detected: false`
- React SPA HTML

### Test 4: Facebook Sharing Debugger

1. Go to https://developers.facebook.com/tools/debug/
2. Enter: `https://www.workie.co.nz/jobs/JOB_UUID_HERE`
3. Click "Scrape Again"
4. Verify `og:title` shows the job-specific title

---

## Troubleshooting

### Worker not executing (no X-Worker-Status headers)

1. **Check Custom Domain**: Dashboard → Workers → workie-og-proxy → Settings → Domains. Verify `www.workie.co.nz` is listed as a Custom Domain (not just a Route)
2. **Check DNS is proxied**: Orange cloud must be ON
3. **Check deployment**: Workers → workie-og-proxy → verify last deployment succeeded
4. **Purge cache**: Cloudflare Dashboard → Caching → Purge Everything
5. **Check Worker logs**: Workers → workie-og-proxy → Logs → Begin log stream, then hit the URL

### Worker runs but Edge Function returns error

- Verify `apikey` header is included in the fetch to the Edge Function
- Verify the production anon key in `worker.js` matches the production project
- Check Edge Function logs in the backend dashboard

### Facebook Debugger still shows generic OG tags

1. Purge Cloudflare cache
2. In Facebook Debugger, click "Scrape Again" (not just "Debug")
3. Check the `X-Worker-Status` header using PowerShell test above
4. If Worker isn't executing, the Custom Domain may not be configured

### WhatsApp preview not updating

WhatsApp caches link previews aggressively:
1. Send the link in a new chat (not the same conversation)
2. Wait 5-10 minutes and try again
3. WhatsApp caches can last up to 24 hours

---

## Production Credentials

The Worker uses **production** Supabase credentials (project ref: `xzrlnezeuubdoqllvodi`). Do NOT use the test/development project (`dkhcdzxelkkpxhmxazqi`) in the Worker — it must point to the live database where real job data exists.

The anon key is a publishable key and is safe to include in the Worker code.
