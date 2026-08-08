---
name: School Management App bug fixes
description: Critical bugs found and fixed in the imported School Management App monorepo.
---

# Key Bugs Fixed

**Why:** These were real data-integrity and security bugs, not just style issues.

## 1. Attendance bulkUpsert — no transaction (data loss risk)
- `pgAdapter.ts` → `attendance.bulkUpsert`: delete + insert were not in a transaction.
- Fix: wrapped both in `db.transaction(async (tx) => { ... })`.

## 2. Exam results bulkUpsert — conflict update was a no-op
- `pgAdapter.ts` → `examResults.bulkUpsert`: `onConflictDoUpdate.set` used `examResultsTable.marks` (the stored value) instead of `drizzleSql\`excluded.marks\`` (the incoming value).
- Effect: saving exam marks for an existing student silently did nothing.
- Fix: changed all three conflict-update fields to use `drizzleSql\`excluded.*\``.

## 3. Teacher login — credentials leaked client-side
- `AuthContext.tsx`: fetched all teachers via `GET /api/teachers`, then compared username/password in the mobile app — exposing every teacher's plaintext password to the client.
- Fix: added `POST /api/teachers/login` endpoint in `teachers.ts` that validates server-side and returns the teacher without the password field. Updated `AuthContext.tsx` to use it.

## 4. Bulk promotion — no transaction
- `pgAdapter.ts` → `promotions.bulkPromote`: student class update and promotion record insert were separate queries.
- Fix: wrapped in `db.transaction(async (tx) => { ... })`.

## 5. Mark edit permission with legacy results
- Existing exam results can predate `mark_submissions` metadata.
- Fix: treat stored marks without a submission row as submitted/read-only for teachers unless the explicit `allowMarkEdit` permission is enabled; enforce the same rule before API writes.

## How to apply
Any future edits to these methods should preserve the transaction wrappers. Teacher password is still stored as plaintext — hashing is a follow-up improvement.
