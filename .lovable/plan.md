

# Upgrade Questionnaire Generation + Remove Eligibility Popup

## Overview
This plan upgrades the AI questionnaire prompt (v1 to v2), ensures required skills generate atomic check questions, removes the separate "Eligibility Check" popup (ApplicationRequirementsDialog), and makes eligibility determined entirely through the questionnaire + stored profile data during AI scoring.

## Changes

### 1. Update `generate-job-questionnaire` Edge Function
**File:** `supabase/functions/generate-job-questionnaire/index.ts`

- Fetch the job's `skills_required`, `requires_car`, `requires_heavy_lifting`, `requires_standing` fields alongside existing fields
- Build a `known_candidate_fields_list` string listing all employee_profile fields the system already captures (visa_status, city, suburb, country, availability, is_available, has_car, comfortable_heavy_lifting, comfortable_standing, phone, languages, etc.)
- Build a `required_skills_list` from `job.skills_required` array
- Replace the system prompt and user prompt with the new v2 prompt provided:
  - System: short practical screening questions, no sensitive personal questions
  - User: the full v2 prompt with rules about not asking for already-known data, atomic skill checks, 5-7 questions max, no eligibility popup, etc.
- Change `version` from `questionnaire_v1` to `questionnaire_v2`
- Update `prompt_version` from `qgen_v1` to `qgen_v2`

### 2. Update `score-application-ai` Edge Function
**File:** `supabase/functions/score-application-ai/index.ts`

- Update the scoring prompt to explicitly instruct the AI to combine:
  - Profile data (visa, location, availability, transport, physical capabilities)
  - Questionnaire answers
  - Contractor required skills match
- Add the job's `skills_required`, `requires_car`, `requires_heavy_lifting`, `requires_standing` to the scoring context so the AI can factor in profile-vs-job requirement alignment
- This replaces the separate eligibility check -- the AI score now captures eligibility concerns in the `reason_summary`

### 3. Remove Eligibility Check Popup
**File:** `src/pages/JobDetail.tsx`

- Remove the `ApplicationRequirementsDialog` import and rendering
- Remove the `showRequirementsDialog` state
- Change `handleApply` to call `proceedWithApplication` directly (after the client-side experience check)
- Keep the client-side visa blocker (Tourist/Visitor visa) as an immediate rejection since this is a legal requirement that should not be deferred to AI scoring

**File:** `src/components/jobs/ApplicationRequirementsDialog.tsx`
- This file can be left in place (no deletion needed) but will no longer be used from JobDetail. It could be cleaned up later.

### 4. Update `validate-job-requirements` Edge Function (Optional Simplification)
**File:** `supabase/functions/validate-job-requirements/index.ts`

- Simplify to only check the visa blocker (legal requirement)
- Remove physical requirements, car, and skills checks since these are now handled by the questionnaire + AI scoring
- Or: keep as-is since it's no longer called from the frontend flow

## Technical Details

### Known Candidate Fields List (passed to LLM)
```
visa_status, city, suburb, country, location_region, availability, is_available,
has_car, comfortable_heavy_lifting, comfortable_standing, has_ird_number,
phone, languages, skills, experience_years, industry, bio, headline,
date_of_birth, work_experience, education
```

### Questionnaire Generation Changes
- Fetch `skills_required` from the job record
- For each skill in `skills_required`, the LLM is instructed to create an atomic yes/no question (e.g., "Do you have experience with [skill]?")
- The LLM will not ask about visa, location, availability, transport, or physical capabilities since these are already in the candidate profile

### Application Flow (After Changes)

```text
User clicks "Apply"
  |
  v
Client-side visa check (Tourist/Visitor visa blocked immediately)
  |
  v
User fills in questionnaire answers (if open_ai_top10)
  |
  v
submit-application edge function (existing validation: cooldowns, limits, etc.)
  |
  v
score-application-ai (combines profile + answers + skills for 0-100 score)
```

The separate eligibility popup step is removed. Eligibility is now implicitly determined by the AI score combining all available data.

### What Stays the Same
- The questionnaire UI rendering in JobDetail.tsx (RadioGroup, Select, Input for question types)
- The submit-application flow and its validations (cooldowns, credit limits)
- The score-application-ai -> refresh-top-candidates pipeline
- The cover letter field
- All RLS policies

