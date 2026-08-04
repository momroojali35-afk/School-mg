---
name: Scoped premium alerts
description: The two requested native feedback alerts use a shared branded component without replacing unrelated alert flows
---

The Add Student required-fields warning and Exams update confirmation are intentionally opt-in premium alerts. Other native alerts and existing custom modals should remain unchanged unless the user explicitly requests them.

**Why:** The user specifically asked to redesign only those two popup messages and not touch any others.

**How to apply:** Reuse the premium alert component only for these two flows; preserve their original title, message, and one-tap dismissal behavior.