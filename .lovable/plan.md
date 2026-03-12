

## Plan: Fix 4 Pooling Process Issues

### Issue 1: "Approved_to_pool" status label is unprofessional

**Problem**: Raw database status `approved_to_pool` is displayed as-is in badges across the UI.

**Fix**: Add a display label map in `ApplicantList.tsx` StatusBadge and any other location showing this status. Map `approved_to_pool` to "In Talent Pool" (already done in `JobApplicants.tsx` but missing in `ApplicantList.tsx`).

**Files to edit**:
- `src/components/applicants/ApplicantList.tsx` -- Update `StatusBadge` to use friendly labels: `approved_to_pool` -> "In Talent Pool", `pending` -> "Pending", etc.
- `src/pages/contractor/ContractorJobDetail.tsx` -- If status badges appear here, apply the same label map.

---

### Issue 2: No chat message sent when applicant is approved to pool

**Problem**: The `update-application-status` edge function upserts the pool membership but never sends a message to the existing conversation or creates a notification.

**Fix**: After successful pool upsert in the edge function, insert a system-style message into the conversation (if one exists) and create a notification for the employee.

**File to edit**:
- `supabase/functions/update-application-status/index.ts` -- After the `approved_to_pool` block (line ~148), look up the conversation for this application, insert a message like: "You've been added to [Company]'s talent pool for [category]. You can now browse and request available shifts from your Talent Pools page." Also insert a notification row.

---

### Issue 3: No dedicated "My Shifts" page for employees

**Problem**: Employees can only see shifts buried inside the "My Pools" page by expanding each pool. There's no unified view of all their shift assignments (confirmed, requested, completed).

**Fix**: Create a new `src/pages/employee/MyShifts.tsx` page showing all the employee's shift assignments across all jobs/pools, grouped by status (Upcoming Confirmed, Pending Requests, Past/Completed). Add a route `/employee/shifts` and a dashboard card.

**Files to create/edit**:
- `src/pages/employee/MyShifts.tsx` (new) -- Query `shift_assignments` for the current user, join with `job_shifts` and `jobs` for context. Group by: Upcoming Confirmed, Pending Requests, Past shifts.
- `src/App.tsx` -- Add lazy import and route for `/employee/shifts`.
- `src/pages/Dashboard.tsx` -- Add a "My Shifts" card for employees linking to `/employee/shifts`.

---

### Issue 4: Employee self-assignment to shifts (configurable by contractor)

**Problem**: Currently only contractors can assign workers to shifts. Employees should be able to self-assign based on the job's `shift_allocation_mode` (already partially implemented via `EmployeeShiftBrowser`).

**Analysis**: The `EmployeeShiftBrowser` component and the `manage-shifts` edge function already support `request_shift` and `claim_shift` actions with atomic RPCs. The `MyPools` page already renders `EmployeeShiftBrowser` per job. The new `MyShifts` page will also link to available shifts. The infrastructure is largely in place.

**Fix**: Ensure the new `MyShifts` page includes a section/link to browse available shifts. The `EmployeeShiftBrowser` already handles both modes. Add a prominent "Browse Available Shifts" link from `MyShifts` to `MyPools` (where shift browsing lives). Optionally, surface available shifts directly on `MyShifts` as well.

**Files to edit**:
- `src/pages/employee/MyShifts.tsx` (new, from Issue 3) -- Include an "Available Shifts" section that reuses `EmployeeShiftBrowser` or links to pools page.

---

### Summary of changes

| File | Action |
|------|--------|
| `src/components/applicants/ApplicantList.tsx` | Fix status label display |
| `supabase/functions/update-application-status/index.ts` | Add chat message + notification on pool approval |
| `src/pages/employee/MyShifts.tsx` | New page: employee shift dashboard |
| `src/App.tsx` | Add route `/employee/shifts` |
| `src/pages/Dashboard.tsx` | Add "My Shifts" card for employees |

