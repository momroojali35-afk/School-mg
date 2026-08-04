---
name: Staff APK database readiness
description: The readiness and teacher-login contract for released staff APKs
---

Hosted deployments may use `DATABASE_URL` or `APP_DATABASE_URL` without a local database-manager connection entry. That environment-backed adapter is still a valid shared school database and must report the API as ready.

**Why:** A fresh staff phone has no locally cached setup flag. Blocking teacher login solely because the mobile readiness cache is false or stale shows the setup modal even when the deployed API and school database are healthy.

**How to apply:** The API readiness response must report `connected: true` whenever an adapter is active, including the environment fallback. Teacher login should be attempted directly and show the setup message only for an explicit database-unavailable response. After changing mobile login logic, build and distribute a new APK; old release bundles retain the previous client behavior.