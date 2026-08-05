---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

The admin and teacher birthday dashboards expose a text-only WhatsApp wish action separately from the PNG-card action. Card shortcuts open the card flow, which captures a PNG and uses a targeted Android WhatsApp send intent with a shareable content URI; they must not use the generic image share sheet.

**Why:** Dashboard buttons can be pressed before the card modal mounts, while native WhatsApp text URLs can be routed to SMS on some Android devices. A targeted intent is required to attach the PNG and open the registered chat directly.

**How to apply:** Keep the text wish action distinct from card actions. Route card shortcuts through the card modal and its direct PNG helper. On Android, provide both package and matching ContactPicker class for regular WhatsApp and WhatsApp Business because expo-intent-launcher only applies package targeting when a class is supplied. Convert Android file URIs to content URIs before granting WhatsApp read access. Birthday lists include graduated students; do not apply active-student filtering.

**Validated:** On August 5, 2026, the Android bundle exported successfully with the targeted regular/Business WhatsApp intent and the API/mobile workflows started cleanly.