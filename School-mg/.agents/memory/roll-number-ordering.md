---
name: Numeric roll-number ordering
description: Student roster views must order roll numbers numerically and keep non-numeric values deterministic.
---

# Numeric roll-number ordering

Student lists should use a shared numeric comparator so values appear as 1, 2, 10 rather than text order 1, 10, 2. Numeric roll numbers come first; blank or non-numeric values follow with deterministic roll/name tie-breakers.

**Why:** Students were displayed in API insertion order or lexicographic order, making class rosters and mark-entry rows appear out of serial order.

**How to apply:** Use the shared comparator for every active-student roster or class picker. When showing all classes, sort by class first and roll number second. This changes display/processing order only; never rewrite stored roll-number values.