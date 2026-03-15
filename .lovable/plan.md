

## Plan: Cost Optimization, Data Retention Transparency, and NZ Country Validation

### Cost Estimate: Gemini 2.5 Flash at 10K uploads/month

Gemini 2.5 Flash pricing (via Lovable AI gateway):
- Input: ~$0.15 per 1M tokens; Output: ~$0.60 per 1M tokens
- A typical visa PDF/image with the structured extraction prompt uses roughly **~2,000 input tokens** (image + system/user prompt) and **~300 output tokens** (tool call response)
- Per request: ~$0.0003 input + $0.00018 output ≈ **$0.0005/request**
- **10,000 requests/month ≈ $5/month** (vs ~$25-40/month with Gemini 2.5 Pro)

Note: Lovable AI charges per request on top of model costs. Actual billing depends on your workspace plan and credit balance. The model cost itself is minimal.

---

### Changes

#### 1. Switch to `google/gemini-2.5-flash` (Edge Function)
- **File:** `supabase/functions/process-work-verification/index.ts` line 112
- Change `model: "google/gemini-2.5-pro"` → `model: "google/gemini-2.5-flash"`

#### 2. Add NZ Country Validation (Edge Function)
- Add `issuing_country` field to the extraction tool schema (string, e.g. "New Zealand", "Australia")
- Add it to the `ExtractionResult` interface
- Add a new check in `makeDecision()` after the document type check:
  - If `issuing_country` is extracted and does not match "New Zealand" / "NZ", reject with reason: `"This document was issued by [country], not New Zealand. Only NZ-issued documents are accepted."`
  - Low confidence → route to `review_required` instead of hard reject
- Update the AI system prompt to instruct: "Identify the issuing country of the document"

#### 3. Add Data Retention Messaging (UI)
- **File:** `src/components/settings/VerifyWorkRightsSection.tsx`
- Add an info box below the upload area explaining:
  - Documents are deleted immediately after automated processing
  - If manual review is needed, documents are retained for up to 7 days then permanently deleted
  - Once verified, users do not need to re-upload unless their verification expires or is rejected
- Use a subtle `Info` icon with muted styling to keep it non-intrusive

#### 4. Redeploy Edge Function
- Deploy updated `process-work-verification` function with both the model switch and country validation changes

