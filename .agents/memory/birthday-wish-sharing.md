---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

The birthday dashboard action must use direct WhatsApp messaging on native platforms and whenever the birthday-card ref is not mounted. Browser-only DOM capture and Web Share APIs are valid only for the explicitly opened card flow on web.

**Why:** Dashboard buttons can be pressed before the card modal mounts, and Expo native does not provide `navigator`, `document`, `File`, or `html2canvas` browser behavior.

**How to apply:** Keep the visible buttons and card UI unchanged; route direct dashboard wishes through the existing WhatsApp helper, while preserving web card capture for the card modal’s share action. Birthday wishes include graduated students; do not apply active-student filtering to birthday lists.