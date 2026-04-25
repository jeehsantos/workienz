# Contractor Company Verification (NZBN)

Mandatory NZBN-based company verification for contractors. Contractors cannot publish jobs until their NZBN is verified against the NZ Government MBIE NZBN Register.

## 1. Database migration

Add columns to `contractor_profiles`:

```sql
ALTER TABLE contractor_profiles
  ADD COLUMN IF NOT EXISTS nzbn TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nzbn_data JSONB;

CREATE INDEX IF NOT EXISTS idx_contractor_profiles_nzbn
  ON contractor_profiles(nzbn) WHERE nzbn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_verification_status
  ON contractor_profiles(verification_status);
```

Use a validation trigger (not CHECK constraint) to enforce `verification_status IN ('unverified','verified','rejected')`.

## 2. Secrets (requested via add_secret after approval)

- `NZBN_SUBSCRIPTION_KEY_SANDBOX` — Sandbox subscription key from portal.api.business.govt.nz
- `NZBN_SUBSCRIPTION_KEY_PRODUCTION` — Production subscription key
- `NZBN_ENVIRONMENT` — `sandbox` or `production` (controls which key + base URL is used)

Base URLs:
- Sandbox: `https://api.business.govt.nz/sandbox/services/v5/nzbn/entities/{nzbn}`
- Production: `https://api.business.govt.nz/services/v5/nzbn/entities/{nzbn}`

Auth header: `Ocp-Apim-Subscription-Key: <key>`

## 3. New Edge Function `validate-nzbn`

`supabase/functions/validate-nzbn/index.ts`

- Two-client pattern (`authClient` for JWT verification, `serviceClient` for DB writes)
- Zod validation: `nzbn` must be exactly 13 numeric digits
- Look up authenticated user's `contractor_profile` (no client-supplied `user_id`)
- Block if profile already `verification_status = 'verified'`
- Call NZBN API with the env-selected subscription key
- Map response: `entityStatusCode` ∈ {`50`/`REGISTERED`, `60`/`ACTIVE`} → verified
- Update `contractor_profiles`: `nzbn`, `verification_status='verified'`, `verification_date=now()`, `nzbn_data=<full response>`
- Insert in-app notification ("Company verified: <entityName>")
- On rejection (deregistered, removed) → set `verification_status='rejected'` and return clear error
- Handle 404 (NZBN not found), 401 (bad key), 429 (rate limit), 5xx (upstream down)
- CORS + structured JSON errors

## 4. Update `create-job` edge function

After fetching contractor profile, gate publication:

```ts
if (contractor.verification_status !== 'verified') {
  return new Response(JSON.stringify({
    error: 'Company verification required',
    code: 'VERIFICATION_REQUIRED'
  }), { status: 403, headers: corsHeaders });
}
```

## 5. New page `/contractor/verify`

`src/pages/contractor/VerifyCompany.tsx` rendering `ContractorVerificationFlow`.

`src/components/contractor/ContractorVerificationFlow.tsx`:
- Card styled like `VerificationStatusCard.tsx`
- 13-digit numeric input (mask non-digits, show count `x/13`)
- "Verify Company" button → `supabase.functions.invoke('validate-nzbn', { body: { nzbn } })`
- Loading spinner, success state shows entity name + "Go to Dashboard"
- Error toast with friendly messages per `code` (NOT_FOUND, INVALID_NZBN, ALREADY_VERIFIED, NOT_ACTIVE, etc.)
- Helper link to https://www.nzbn.govt.nz/ for users who don't know their NZBN
- Skip rendering if already verified — show success state instead

## 6. Dashboard status card

`src/components/dashboard/ContractorVerificationStatus.tsx` — modeled on `VerificationStatusCard.tsx`:
- Reads `contractor_profiles.verification_status` + `nzbn_data->>'entityName'`
- `verified` → green ShieldCheck + company name + "View Details"
- `rejected` → red XCircle + "Verification Rejected" + "Try Again" → `/contractor/verify`
- `unverified` → amber ShieldAlert + "Verify your company to post jobs" + "Verify Now" CTA → `/contractor/verify`

Mounted in `src/pages/Dashboard.tsx` for contractor users (alongside other contractor cards).

## 7. Routing & guards

- Add `<Route path="/contractor/verify" element={<VerifyCompany />} />` in `src/App.tsx` (lazy-loaded, protected)
- `PostJob.tsx` already calls `validate-job-posting`; the 403 from `create-job` is the hard gate, but additionally surface a friendly inline banner on `/contractor/post-job` if `verification_status !== 'verified'` with a link to verify (UX, not security)

## 8. Untouched (per requirements)

- Employee work rights verification (`process-work-verification`) — **not modified**
- `AdminVerificationReview.tsx` — **not modified** (employee-only review tool)

## Files

**Created**
- `supabase/migrations/<timestamp>_contractor_nzbn_verification.sql`
- `supabase/functions/validate-nzbn/index.ts`
- `src/components/contractor/ContractorVerificationFlow.tsx`
- `src/components/dashboard/ContractorVerificationStatus.tsx`
- `src/pages/contractor/VerifyCompany.tsx`

**Modified**
- `supabase/functions/create-job/index.ts` (add verification gate)
- `src/pages/Dashboard.tsx` (mount status card)
- `src/App.tsx` (add route)
- `src/pages/contractor/PostJob.tsx` (inline banner if unverified — UX only)

## Post-approval order

1. Request the 3 NZBN secrets (`add_secret`)
2. Apply migration
3. Deploy `validate-nzbn`, test sandbox call with a known NZBN (e.g. 9429000000000-pattern)
4. Wire `create-job` gate
5. Build frontend components + route
6. Smoke test full flow on `/contractor/verify`
