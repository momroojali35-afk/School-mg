---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

The birthday dashboard action uses direct WhatsApp messaging when the card ref is not mounted; the explicitly opened card's send action shares the rendered PNG through the native share sheet on mobile and Web Share API on web.

**Why:** Dashboard buttons can be pressed before the card modal mounts, while native WhatsApp text URLs can be routed to SMS on some Android devices. Sharing a typed PNG file lets WhatsApp receive the birthday card as an image.

**How to apply:** Keep the visible buttons and card UI unchanged; route unopened-card shortcuts through the existing WhatsApp helper, and route the card modal’s share button through native PNG capture/share or web capture/share. Birthday wishes include graduated students; do not apply active-student filtering to birthday lists.