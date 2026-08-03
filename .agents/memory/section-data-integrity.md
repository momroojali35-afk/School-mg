---
name: Section data integrity
description: Durable rules for managing school sections when older student records may predate the sections table.
---

# Section data integrity

Section names can exist in existing student records even when no matching row exists in the dedicated sections collection/table.

**Why:** Older data may have stored a section directly on a student before section CRUD was introduced. Listing only the dedicated sections store makes valid existing sections disappear from the UI.

**How to apply:** Build section lists from both the dedicated sections store and non-empty student section values. When renaming or deleting a section, update or clear matching student assignments in the same adapter operation, and mirror the result in the mobile app state.