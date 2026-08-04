---
name: Promotion success modal
description: Approved visual and interaction boundary for successful bulk student promotions
---

Successful bulk promotions use a branded in-app success modal with a blue gradient header, green confirmation orb, concise movement summary, and a primary Continue action. Individual promotions remain quiet and do not show this bulk-success modal.

**Why:** The native alert was visually inconsistent with the school app and could not communicate the result with enough hierarchy; the approved modal keeps the action clear while preserving the existing promotion flow.

**How to apply:** Keep the modal tied to the completed bulk-promotion result, dismiss it without mutating promotion data, and preserve the existing confirmation modal for the action before it runs.