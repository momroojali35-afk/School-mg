---
name: Request document storage
description: Storage model and deletion expectations for uploaded application documents.
---

Application request documents are stored as base64 data on the request record rather than as separate object-storage files.

**Why:** The current app has no separate storage-object identifier or upload/delete adapter for these documents, so deleting the request record is the durable way to remove both the request and its embedded file.

**How to apply:** Preserve the request-level hard-delete path and clear-document path together; do not introduce a UI-only removal or assume an external storage object exists unless the storage model changes.