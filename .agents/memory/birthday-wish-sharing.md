---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

All birthday wish actions on the admin and teacher dashboards open a direct WhatsApp chat to the registered student or guardian mobile number. Birthday card buttons capture a PNG and use a targeted Android WhatsApp send intent with a shareable content URI; they must not use the generic image share sheet.

**Why:** Dashboard buttons can be pressed before the card modal mounts, while native WhatsApp text URLs can be routed to SMS on some Android devices. A targeted intent is required to attach the PNG and open the registered chat directly.

**How to apply:** Keep the visible buttons and card UI unchanged; route unopened-card shortcuts through the text WhatsApp helper, and route the card modal’s share button through the direct PNG helper. Convert Android file URIs to content URIs before granting WhatsApp read access. Birthday wishes include graduated students; do not apply active-student filtering to birthday lists.