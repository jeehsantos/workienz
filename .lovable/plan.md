
# Fix Social Media Sharing Previews for Job Posts

## Problem Summary
Social media platforms (WhatsApp, Facebook, Instagram) show the generic site title instead of the job-specific title because:
1. The Vercel rewrites that route crawlers to the Edge Function only work on Vercel-hosted domains
2. The current setup copies the direct job URL (`www.workie.co.nz/jobs/{id}`) to clipboard, not the Edge Function URL
3. Social media crawlers cannot execute JavaScript, so they never see the dynamically-injected OG tags

## Solution Overview
Update the `ShareJob` component to share a **dedicated share URL** that the Edge Function can serve with pre-rendered OG tags. This bypasses the need for Vercel rewrites.

## Technical Changes

### 1. Update ShareJob Component
Modify `src/components/jobs/ShareJob.tsx` to use the Edge Function URL for social sharing:

- **For WhatsApp/Facebook sharing buttons**: Use the Edge Function URL so crawlers receive pre-rendered HTML with correct OG tags
- **For "Copy Link" button**: Keep using the canonical public URL (user-friendly) but inform users that social previews use a special share mechanism
- **Alternative approach**: Use a short-link pattern like `/s/jobs/{id}` that redirects via the Edge Function

**Key insight**: The Edge Function already handles the redirect to the final job URL after 1 second, so users will land on the correct page.

### 2. Option A - Direct Edge Function URL (Simplest)
Update sharing to use:
```
https://dkhcdzxelkkpxhmxazqi.supabase.co/functions/v1/share-job?id={job_id}
```

- WhatsApp and Facebook buttons will share this URL
- Social crawlers hit the Edge Function directly, getting correct OG tags
- Users are redirected to `www.workie.co.nz/jobs/{id}` after 1 second

### 3. Option B - Cloudflare Workers / Vercel Edge (Production)
If you want the public URL to work directly for social sharing on the production domain, you would need server-side routing on `www.workie.co.nz` to intercept crawler requests. This requires the Vercel hosting or a Cloudflare Worker in front of the domain.

## Recommended Implementation

### Phase 1 - Immediate Fix
Update `ShareJob.tsx`:

```typescript
// Edge Function URL for social sharing (crawlers get pre-rendered OG tags)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const shareUrl = `${SUPABASE_URL}/functions/v1/share-job?id=${jobId}`;

// For WhatsApp/Facebook - use Edge Function URL
const shareOnWhatsApp = () => {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${shareUrl}`)}`;
  window.open(whatsappUrl, "_blank");
};

// For Copy Link - still copy the public URL (cleaner for users)
const copyToClipboard = () => {
  navigator.clipboard.writeText(publicJobUrl);
  // ...
};
```

### Phase 2 - Production Domain (Optional)
If you deploy to Vercel with the `www.workie.co.nz` domain, the existing `vercel.json` rewrites will automatically route social media crawlers to the API proxy, making the canonical URLs work for social sharing.

## Files to Modify
1. `src/components/jobs/ShareJob.tsx` - Update share URLs to use Edge Function for WhatsApp/Facebook

## Testing Steps
1. After changes, click "WhatsApp" button on a job detail page
2. Send the job to a WhatsApp chat
3. Verify the preview shows the correct job title (e.g., "Cleaning house in Fairy Springs, Rotorua - Workie")
4. Verify clicking the link redirects to the job detail page
5. Test with Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Edge Function URL | Works immediately, no server config needed | URL looks technical (supabase.co domain) |
| Vercel Rewrites | Clean canonical URLs | Only works on Vercel hosting |
| Cloudflare Worker | Works with any hosting | Requires Cloudflare setup |

## Recommendation
Implement **Option A** (Edge Function URL for social sharing) as the immediate fix. The 1-second redirect means users still land on the clean `www.workie.co.nz` URL, and the technical share URL is only seen briefly in the WhatsApp/Facebook preview card.
