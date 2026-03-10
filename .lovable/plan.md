

## Plan: Remove Hiring Style Selector, Default All Jobs to AI Scoring

### Context
The hiring style toggle (`slot_1to1` vs `open_ai_top10`) is no longer needed since all jobs should use AI-powered application analysis. The UI selector will be removed and all new jobs will default to `open_ai_top10`. Existing jobs in the database retain their `hiring_style` column value — no migration needed, as the backend edge functions already handle both modes gracefully.

### Changes

#### 1. Remove Hiring Style selector from Job Details step
**File:** `src/components/jobs/steps/JobDetailsStep.tsx`
- Remove `hiringStyle` and `onHiringStyleChange` props
- Remove the entire "Hiring Style" selector UI block (the two cards with `Users` and `Sparkles` icons)
- Remove `Users, Sparkles` icon imports

#### 2. Hardcode hiring style in PostJob
**File:** `src/pages/contractor/PostJob.tsx`
- Remove `hiringStyle` state (line 75) — hardcode `"open_ai_top10"` in `createJob`
- Remove `hiringStyle` and `onHiringStyleChange` props from `<JobDetailsStep>`
- In `createJob`, always set `hiring_style: "open_ai_top10"` and `hiring_config: { top_n: 10, question_count: 8, score_version: "v1", refresh_debounce_seconds: 60 }`

#### 3. Hardcode hiring style in EditJob
**File:** `src/pages/contractor/EditJob.tsx`
- Remove `hiringStyle` state (line 63)
- Remove `hiringStyle`/`onHiringStyleChange` props from `<JobDetailsStep>`
- In the update function, always set `hiring_style: "open_ai_top10"` and the standard `hiring_config`

#### 4. Always show AI Applicants view
**File:** `src/pages/contractor/JobApplicants.tsx`
- Remove the `if (job.hiring_style === "open_ai_top10")` conditional (line 284) — always render `<AIApplicantsView>`
- Keep `hiring_style` in the query/type for backward compat (no harm)

#### 5. Always show questionnaire on job application page
**File:** `src/pages/JobDetail.tsx`
- Remove conditional checks on `hiring_style === 'open_ai_top10'` — always load the questionnaire and always show screening questions
- Keep the `hiring_style` field in the query (backward compat) but don't branch on it

### What stays unchanged
- Database schema — no migrations needed
- Edge functions (`submit-application`, `score-application-ai`, `generate-job-questionnaire`, `refresh-top-candidates`) — they already handle the `open_ai_top10` path and will work correctly since all new jobs will have that style
- Existing `slot_1to1` jobs in the DB continue to work (the old applicant view is just replaced by the more capable AI view for all jobs)

### Risk assessment
- **Low risk**: All changes are UI-only (removing a toggle, removing conditionals)
- The `AIApplicantsView` already handles jobs without questionnaires gracefully
- The `JobDetail.tsx` questionnaire fetch uses `maybeSingle()` so it won't error for old jobs without questionnaires

