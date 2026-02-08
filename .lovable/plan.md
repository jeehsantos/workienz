

# Fix Social Media OG Previews - Worker Custom Domain Approach

## Problem Identified

The Cloudflare Worker is not executing because of a **routing priority conflict**. Your domain `www.workie.co.nz` CNAMEs to `workienz.lovable.app`, which is hosted on Cloudflare's infrastructure. This creates a "Cloudflare-to-Cloudflare" (orange-to-orange) proxy situation where Lovable's Cloudflare SaaS routing silently takes priority over your Worker Routes. This is a known Cloudflare behavior, not a bug in your configuration.

Cloudflare's request processing order:
```text
1. Worker Custom Domains  <-- highest priority (THE FIX)
2. Page Rules / Redirect Rules
3. Worker Routes           <-- your current setup (blocked by #4)
4. SaaS routing (Lovable)  <-- currently winning
```

## Solution: Worker Custom Domain + Git Deployment

### Step 1: Add files to the repository (Lovable will implement)

Two new files will be created:

**`wrangler.toml`** - Cloudflare Worker configuration:
- Worker name: `workie-og-proxy`
- Entry point: `worker.js`
- Compatibility date: `2026-02-06`
- Routes defined for `workie.co.nz/jobs/*` and `www.workie.co.nz/jobs/*`

**`worker.js`** - The Worker source code (at repo root):
- Uses the **production** backend URL (`xzrlnezeuubdoqllvodi`)
- Uses the **production** anon key
- Same bot detection and Edge Function proxy logic
- Passes through non-bot and non-job traffic to origin

### Step 2: Update Cloudflare Build Settings (you do this manually)

In Cloudflare Dashboard, go to your Worker (`workie-og-proxy`) > Settings > Build:

1. Change **Build command** from `bun run build` to: (leave empty or type `echo skip`)
   - The current `bun run build` runs Vite which is unnecessary for the Worker
2. Keep **Deploy command** as: `npx wrangler deploy`
3. Keep **Root directory** as: `/`
4. Keep **Production branch** as: `og-implementation`

### Step 3: Add Custom Domain (you do this manually)

This is the critical fix. In Cloudflare Dashboard:

1. Go to your Worker (`workie-og-proxy`) > Settings > Domains and Routes
2. Click **+ Add** > Select **Custom Domain**
3. Add: `www.workie.co.nz`
4. Cloudflare will show a confirmation - accept it
5. If you also want the non-www version: add `workie.co.nz` too

Custom Domains have the highest routing priority and will override the SaaS routing conflict.

**Important:** After adding the Custom Domain, you can optionally remove the old Worker Routes (`workie.co.nz/jobs/*` and `www.workie.co.nz/jobs/*`) since the Custom Domain handles all traffic and the Worker code already filters by path.

### Step 4: Merge and Deploy

After Lovable adds the files to your main branch:

1. In your Git repository, merge `main` into the `og-implementation` branch (or create it from main)
2. Push to `og-implementation` - this triggers Cloudflare's automatic build and deploy
3. Cloudflare runs `npx wrangler deploy` which reads `wrangler.toml` and deploys the Worker

### Step 5: Test and Verify

1. **Purge Cloudflare cache** (Caching > Purge Everything)
2. **Test with bot UA** in PowerShell:
   ```
   (Invoke-WebRequest -Headers @{ "User-Agent"="facebookexternalhit/1.1" } "https://www.workie.co.nz/jobs/c0855e59-cb48-4c08-ad9c-d41ab888e8bf").Headers["X-Worker-Status"]
   ```
   Expected: `proxied-to-edge-function`
3. **Facebook Sharing Debugger**: Scrape Again for the job URL
4. Expected `og:title`: "Cleaning house in Fairy Springs, Rotorua - Workie"

### Step 6: Update documentation

The `docs/cloudflare-worker-setup.md` will be updated to reflect:
- The Custom Domain approach instead of Worker Routes
- The Git-based deployment workflow with `wrangler.toml`
- Updated testing commands

## Technical Details

### Why Custom Domains fix the issue

Worker Custom Domains create a direct binding between the domain and the Worker at the DNS level. Unlike Worker Routes (which operate at the HTTP routing layer and can be overridden by SaaS routing), Custom Domains are processed first in Cloudflare's pipeline. The `fetch(request)` calls within the Worker for pass-through traffic will correctly resolve to the origin (Lovable's servers) without creating infinite loops.

### Files changed

| File | Action | Purpose |
|------|--------|---------|
| `wrangler.toml` | Create | Cloudflare Worker deployment config |
| `worker.js` | Create | Worker source with production credentials |
| `docs/cloudflare-worker-setup.md` | Update | Reflect new deployment approach |

### Risk mitigation

- The Worker passes through ALL non-job-path traffic unchanged, so the rest of the site is unaffected
- For job paths with non-bot User-Agents, traffic also passes through to the SPA
- Only bot requests to `/jobs/{uuid}` are intercepted and proxied to the Edge Function
- If the Edge Function fails, the Worker falls back to serving the SPA (graceful degradation)

