

## NZ Privacy Act 2020 Compliance Review

### Gap Analysis Against the 13 Information Privacy Principles

| Principle | Status | Gap |
|-----------|--------|-----|
| 1. Purpose for collection | Partial | Privacy policy lists what's collected but doesn't clearly state purpose *per category* |
| 2. Source of information | OK | Collected directly from individuals |
| 3. What to tell individuals | **Missing** | No consent checkbox at signup; users aren't explicitly told *at collection time* |
| 4. Manner of collection | OK | Standard web forms |
| 5. Storage and security | OK | RLS, encryption, secure auth in place |
| 6. Access to information | **Missing** | No data export/download feature exists |
| 7. Correction of information | Partial | Users can edit profiles, but no formal correction request mechanism |
| 8. Accuracy before use | OK | Profile editing available |
| 9. Retention limits | **Missing** | No account deletion feature; retention policy is vague |
| 10. Use of information | Partial | Privacy policy covers this but lacks specificity |
| 11. Disclosing information | Partial | Cookie policy mentions Supabase by name (should be abstracted) |
| 12. Disclosure outside NZ | **Missing** | No mention that data is stored overseas (Supabase/Stripe servers) |
| 13. Unique identifiers | OK | Using UUIDs, no government ID reuse |

Additionally:
- **No cookie consent banner** exists (Cookie Policy page exists but no interactive consent mechanism)
- **No notifiable breach process** documented in the privacy policy
- **No Terms/Privacy acceptance checkbox** during signup

### Plan: Address Critical Gaps (5 changes)

#### 1. Add Terms & Privacy consent checkbox to signup form
**File:** `src/pages/Auth.tsx`
- Add a checkbox with label: "I agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy)"
- Add state `agreedToTerms` and validation — block signup if unchecked
- Add error message if unchecked on submit

#### 2. Add Cookie Consent Banner component
**File:** `src/components/CookieConsentBanner.tsx` (new)
- Persistent bottom banner shown to first-time visitors (check `localStorage` for `cookie_consent`)
- Two buttons: "Accept All" and "Essential Only"
- Links to Cookie Policy page
- Stores preference in `localStorage`

**File:** `src/App.tsx`
- Render `CookieConsentBanner` inside the app

#### 3. Update Privacy Policy for full IPP compliance
**File:** `src/pages/PrivacyPolicy.tsx`
- **Principle 3**: Add explicit collection notice section explaining *why* each data type is collected
- **Principle 9**: Add specific retention periods (e.g., "48 hours after conversation closure for messages", "until account deletion for profile data")
- **Principle 11**: Replace "Supabase" with "cloud database provider" in disclosure section
- **Principle 12**: Add new section "International Data Transfers" disclosing that data may be processed on servers outside NZ (cloud infrastructure, Stripe payment processing), with assurance of comparable privacy protections
- **Notifiable Breach**: Add section explaining breach notification process (72-hour commitment to Privacy Commissioner and affected users)
- Update `lastUpdated` to current date

#### 4. Update Cookie Policy
**File:** `src/pages/CookiePolicy.tsx`
- Replace "Supabase" references with "Cloud authentication provider"
- Keep the table structure but abstract provider names

#### 5. Add Privacy & Data section to Settings page
**File:** `src/pages/Settings.tsx`
- Add new sidebar item "Privacy & Data"
- Content includes:
  - "Request My Data" button — triggers email to privacy@workie.co.nz with user ID (simple mailto link for now, satisfies Principle 6)
  - "Request Account Deletion" button — triggers email to privacy@workie.co.nz (satisfies Principle 9)
  - Link to Privacy Policy
  - Note explaining users can contact privacy@workie.co.nz for corrections (Principle 7)

### Files to edit
- `src/pages/Auth.tsx` — consent checkbox
- `src/components/CookieConsentBanner.tsx` — new file
- `src/App.tsx` — render cookie banner
- `src/pages/PrivacyPolicy.tsx` — IPP compliance updates
- `src/pages/CookiePolicy.tsx` — abstract provider names
- `src/pages/Settings.tsx` — privacy & data section

### What this does NOT change
- No database migrations needed
- No edge function changes
- No changes to existing RLS policies or auth flow
- No regressions to existing functionality — all changes are additive (new component, new settings section, updated static content, one checkbox addition to form)

