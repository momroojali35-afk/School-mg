---
name: Marksheet academic session
description: The marksheet generator uses an admin-selected academic session for generated documents.
---

The academic session is an admin-only generator setting, persisted locally on the device, and applied consistently to single, combined, individual, bulk, preview-triggered, print, and PDF output generation.

**Why:** Administrators may need to issue marksheets for a session other than the current calendar-derived session without changing exam data or the marksheet layout.

**How to apply:** Keep session selection separate from exam/result records and pass the selected value through every marksheet document builder; preserve the default calendar-derived session when no saved selection exists.