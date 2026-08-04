---
name: Alumni import identity
description: The Alumni import contract and duplicate-handling rule
---

Alumni imports use `student_id` as the natural identity key. The API accepts both snake_case database names and the mobile app's camelCase names, normalizes required identity fields, and keeps the legacy Alumni display fields populated for existing screens.

**Why:** The Alumni table and mobile model evolved separately; inserting the newer import shape directly into the older table caused raw SQL failures and repeat imports could collide.

**How to apply:** Any future Alumni import or creation must preserve `student_id` uniqueness, map `student_name`, `class`, `section`, and `graduation_year`, mark a matching student graduated without deleting history, use null/default-safe optional values, and refresh from the server after writes. The mobile context may explicitly load graduated rows for birthday/history features; active workflows must still use `isActiveStudent`.