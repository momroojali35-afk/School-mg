---
name: Request document storage
description: Storage model and deletion expectations for uploaded application documents.
---

Application request documents are stored as base64 data on the request record rather than as separate object-storage files.

**Why:** The current app has no separate storage-object identifier or upload/delete adapter for these documents, so deleting the request record is the durable way to remove both the request and its embedded file.

**How to apply:** Preserve the request-level hard-delete path and clear-document path together; do not introduce a UI-only removal or assume an external storage object exists unless the storage model changes. Request list reads must bypass HTTP caching so a deleted record cannot return from a stale refresh.

Permanent request deletion must be acknowledged only after the active adapter confirms the row is absent, and the client should reload the no-cache request list before closing the detail view.

**Why:** A UI-only optimistic removal can make a failed or stale delete look successful, allowing the request to reappear after refresh.

**How to apply:** Have the delete route return a confirmed deletion result, then verify that result and a fresh database-backed list in the mobile context before updating local state.

The mobile app can point at an external production API whose deployment is independent from this Replit workspace; source changes and GitHub pushes do not guarantee that API has rebuilt.

**Why:** The production Render service served an older API bundle without parameterized request routes even though the current source and local bundle contained them, while its database still held the request data.

**How to apply:** After API changes, verify the production endpoint itself (including the DELETE route) and manually redeploy the external service if it did not auto-deploy before asking the user to retest the mobile app.