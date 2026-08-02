---
name: GitHub push authentication
description: GitHub API token validation and Git push authentication use different accepted header formats in this environment.
---

GitHub personal access tokens may authenticate successfully against the GitHub API while a Git push using a Bearer authorization header is rejected. Use Basic authentication with the username `x-access-token` and the token as the password for HTTPS pushes.

**Why:** The token was valid, but GitHub rejected the Bearer header during `git push`; Basic token authentication succeeded.

**How to apply:** For HTTPS pushes, provide an `AUTHORIZATION: basic` header containing base64(`x-access-token:<token>`), and never place the token in a remote URL or display it.