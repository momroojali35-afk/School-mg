---
name: Marksheet PDF layout
description: Native and browser marksheet exports use different layout engines and require separate margin handling.
---

Native `expo-print` renders the marksheet HTML directly and does not honor the browser/jsPDF capture margin parameter. Keep a print-only `@page` margin plus a reduced `.page` width and height for native output, while browser output should center the captured image inside A4.

**Why:** The marksheet templates are intentionally exact A4 dimensions for browser canvas capture, which otherwise makes native PDFs touch the top and bottom edges.

**How to apply:** When changing marksheet export spacing, update both the native print override and the browser image-placement logic; preserve equal vertical insets.