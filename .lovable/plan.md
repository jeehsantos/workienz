
# Plan: Admin Toggle for Upgrade Button Visibility

## Overview
Add a checkbox in the Admin Dashboard Settings tab that allows admins to globally hide "Upgrade to Premium" buttons for employees and change contractor upgrade buttons to "Become a Partner" (redirecting to Contact page).

---

## Technical Architecture

### Backend-First Approach
The setting will be stored in the `platform_settings` table and read by all frontend components that display upgrade prompts. This ensures the behavior is controlled centrally and cannot be bypassed by client-side manipulation.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Settings Tab                                             │    │
│  │  ☑ Hide Upgrade Buttons                                  │    │
│  │    - Hides "Upgrade to Premium" for Employees            │    │
│  │    - Changes button to "Become a Partner" for            │    │
│  │      Contractors (→ Contact page)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE                                       │
│  platform_settings                                               │
│  ┌──────────────────────────┬──────────────────────────────┐    │
│  │ setting_key              │ setting_value                │    │
│  ├──────────────────────────┼──────────────────────────────┤    │
│  │ hide_upgrade_buttons     │ true / false                 │    │
│  └──────────────────────────┴──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               FRONTEND COMPONENTS                                │
│  useUpgradeButtonVisibility Hook                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Fetches platform setting and user role                   │    │
│  │ Returns: { showUpgrade, upgradeText, upgradeLink }       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                    ▼                    ▼              │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐          │
│   │ JobDetail│        │Subscrip. │        │ Articles │          │
│   │ Page     │        │ Page     │        │ Page     │          │
│   └──────────┘        └──────────┘        └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Database Migration
Add a new platform setting to control upgrade button visibility.

**SQL Migration:**
```sql
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES ('hide_upgrade_buttons', 'false', 
  'When enabled, hides Upgrade to Premium buttons for employees and shows Become a Partner for contractors')
ON CONFLICT (setting_key) DO NOTHING;
```

---

### Step 2: Create Custom Hook
Create `src/hooks/useUpgradeButtonVisibility.ts` to centralize the logic for determining upgrade button behavior.

**Hook Logic:**
- Fetches the `hide_upgrade_buttons` setting from `platform_settings`
- Determines user role (employee vs contractor)
- Returns:
  - `showUpgrade`: boolean - whether to show the upgrade button
  - `upgradeText`: string - button text ("Upgrade to Premium" or "Become a Partner")
  - `upgradeLink`: string - destination URL ("/pricing" or "/contact")
  - `isLoading`: boolean - loading state

**Behavior Matrix:**

| Setting Enabled | User Role  | Button Visible | Button Text          | Link      |
|-----------------|------------|----------------|----------------------|-----------|
| false           | Employee   | Yes            | Upgrade to Premium   | /pricing  |
| false           | Contractor | Yes            | Upgrade Plan         | /pricing  |
| true            | Employee   | **No**         | -                    | -         |
| true            | Contractor | Yes            | Become a Partner     | /contact  |

---

### Step 3: Update Admin Dashboard Settings Tab
Add a checkbox toggle in the Settings tab of `AdminDashboard.tsx`.

**UI Changes:**
- Add new section "Upgrade Button Visibility" with:
  - Switch toggle for `hide_upgrade_buttons`
  - Description text explaining the behavior
  - Clear visual feedback when enabled/disabled

---

### Step 4: Update Affected Components
Modify all components that display upgrade/premium buttons to use the new hook.

**Files to Update:**

1. **`src/pages/JobDetail.tsx`** (Lines 636-665)
   - "Upgrade to Premium" button in eligibility check
   - "Upgrade to Premium" button in cooldown section

2. **`src/pages/Subscription.tsx`** (Lines 726-755)
   - "Upgrade to Premium" CTA
   - "View Plans" button for no subscription state

3. **`src/pages/employee/Articles.tsx`** (Lines 239-256)
   - "Unlock Premium Articles" banner with "View Plans" button

4. **`src/components/articles/HighlightsSection.tsx`** (Lines 64-97)
   - Links to pricing for locked premium articles

5. **`src/pages/ArticleDetail.tsx`** (Line 272-275)
   - "Subscribe Now" button for locked premium content

6. **`src/components/contractor/ContractorLogoUpload.tsx`** (Lines 193-199)
   - "Upgrade to a paid plan" message for logo upload

7. **`src/pages/contractor/PostJob.tsx`** (Lines 427-430)
   - "Upgrade Plan" button when entitlement error occurs

8. **`src/pages/WorkerProfile.tsx`** (Lines 344-347)
   - "Upgrade Now" button for database browsing

---

### Step 5: Create Reusable UpgradeButton Component
Create `src/components/ui/upgrade-button.tsx` to standardize the upgrade button across the app.

**Props:**
- `size`: button size
- `variant`: button variant
- `className`: additional classes
- `children`: optional override text

**Component Behavior:**
- Uses `useUpgradeButtonVisibility` hook internally
- Returns null if button should be hidden
- Renders appropriate text and link based on user role and setting

---

## Technical Specifications

### Database Change
```sql
-- New platform setting
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'hide_upgrade_buttons', 
  'false', 
  'When enabled: Employees see no upgrade buttons, Contractors see "Become a Partner" redirecting to Contact'
);
```

### Hook Interface
```typescript
interface UseUpgradeButtonVisibilityResult {
  showUpgrade: boolean;
  upgradeText: string;
  upgradeLink: string;
  isLoading: boolean;
}
```

### Component Integration Example
```tsx
// Before (current implementation)
<Button asChild size="sm" className="mt-2">
  <Link to="/pricing">Upgrade to Premium</Link>
</Button>

// After (using new hook)
const { showUpgrade, upgradeText, upgradeLink } = useUpgradeButtonVisibility();
{showUpgrade && (
  <Button asChild size="sm" className="mt-2">
    <Link to={upgradeLink}>{upgradeText}</Link>
  </Button>
)}
```

---

## Files to Create
1. `src/hooks/useUpgradeButtonVisibility.ts` - Central hook for upgrade button logic
2. `src/components/ui/upgrade-button.tsx` - Reusable upgrade button component (optional)

## Files to Modify
1. `src/pages/admin/AdminDashboard.tsx` - Add checkbox toggle in Settings tab
2. `src/pages/JobDetail.tsx` - Use hook for upgrade buttons
3. `src/pages/Subscription.tsx` - Use hook for upgrade CTAs
4. `src/pages/employee/Articles.tsx` - Use hook for premium unlock banner
5. `src/components/articles/HighlightsSection.tsx` - Use hook for article links
6. `src/pages/ArticleDetail.tsx` - Use hook for subscribe button
7. `src/components/contractor/ContractorLogoUpload.tsx` - Use hook for upgrade message
8. `src/pages/contractor/PostJob.tsx` - Use hook for upgrade plan button
9. `src/pages/WorkerProfile.tsx` - Use hook for upgrade now button

## Database Migration
- Add `hide_upgrade_buttons` setting to `platform_settings` table

---

## Performance Considerations
- The setting is cached in React Query with a 5-minute stale time
- Single database query shared across all components using the hook
- No additional API calls needed after initial load

## Responsive Design
- The admin toggle uses the existing Settings tab layout
- All updated buttons maintain their current responsive behavior
- No layout changes required

## Security
- Setting is stored in backend `platform_settings` table
- RLS policies already allow public read access to settings
- Only admins can modify settings (existing policy)
