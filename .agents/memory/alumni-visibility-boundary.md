---
name: Alumni visibility boundary
description: The intentional separation between active student workflows and Alumni birthday visibility.
---

Active student workflows must consume the server’s default student list, which excludes graduated records. Historical attendance, exam, fee, and promotion rows remain stored, but active reports and aggregates must intersect those rows with currently visible student IDs.

**Why:** Alumni migration is a status change, not deletion. Keeping graduated records available in shared active state caused them to leak into selectors, counts, reports, and finance views.

**How to apply:** Keep Alumni in its own state collection. If birthdays need to include graduates, explicitly map Alumni into a student-shaped view only inside birthday UI logic; do not reintroduce graduated students into shared `students` state or general reports. On import, preserve the pass-out class only on Alumni and clear the Student row's active class/section.

**Validated:** On August 5, 2026, a temporary Class 1 student imported through the live API became `graduated` with blank class/section, disappeared from `/students`, and remained in `/alumni` with `passOutClass: "Class 1"`.