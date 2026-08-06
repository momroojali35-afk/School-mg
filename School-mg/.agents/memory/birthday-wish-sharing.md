---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

Birthday-card "Send on WhatsApp" actions on the admin and teacher dashboards capture the visible card as a full-quality local PNG and target WhatsApp with an Android image SEND intent; they must not fall back to text-only WhatsApp URLs.

**Why:** A WhatsApp URL can only carry text and would discard the designed card. Android needs a content URI plus a targeted SEND intent for WhatsApp to receive the exact card image with all rendered student details.

**How to apply:** Keep the visible buttons and card UI unchanged; route every Birthday Wishes action through `captureRef` with PNG quality 1 and the Android WhatsApp intent using `expo-file-system` content URIs and `expo-intent-launcher`. Use the generic image share sheet only as a non-text fallback. Birthday wishes include graduated students; do not apply active-student filtering to birthday lists. Alumni API records commonly use `DD/MM/YYYY`, so normalize that format before matching birthdays.