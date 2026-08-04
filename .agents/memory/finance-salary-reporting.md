---
name: Finance salary reporting
description: Product boundary for salary reporting and salary payment management in the school app
---

The Finance area provides read-only salary reporting: period-filtered paid totals, pending totals, and payment history. Creating or deleting salary payments remains in the Teachers area.

**Why:** Finance is the reporting surface, while teacher records already own the salary-management workflow; duplicating mutations in Finance would create two competing management paths.

**How to apply:** Preserve this separation when extending Finance salary cards, filters, receipts, or exports. Link users back to Teachers for payment mutations.