---
name: Birthday wish sharing
description: Platform constraint for birthday wish actions on the admin and teacher dashboards.
---

Birthday-card "Send on WhatsApp" actions on the admin and teacher dashboards capture the visible card as a full-quality local PNG and open the native image share sheet; they must not fall back to text-only WhatsApp URLs.

**Why:** A WhatsApp URL can only carry text and would discard the designed card. Sharing a local PNG lets WhatsApp receive the exact card image with all rendered student details.

**How to apply:** Keep the visible buttons and card UI unchanged; route the card modal’s share button through `captureRef` with PNG quality 1 and `Sharing.shareAsync` using an image MIME type. If sharing is unavailable, show an error instead of opening a plain-text WhatsApp URL. Birthday wishes include graduated students; do not apply active-student filtering to birthday lists.