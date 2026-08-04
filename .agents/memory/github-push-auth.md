---
name: GitHub push authentication
description: GitHub API token validation and Git push authentication use different accepted header formats in this environment.
---

GitHub personal access tokens may authenticate successfully against the GitHub API while a Git push using a Bearer authorization header is rejected. Use Basic authentication with the username `x-access-token` and the token as the password for HTTPS pushes.

**Why:** The token was valid, but GitHub rejected the Bearer header during `git push`; Basic token authentication succeeded.

**How to apply:** For HTTPS pushes, provide an `AUTHORIZATION: basic` header containing base64(`x-access-token:<token>`), and never place the token in a remote URL or display it.

When a push is rejected because GitHub has newer commits, fetch `origin/main`, apply the requested change on top of that remote base, and push normally; do not force-push over the newer history.

**Why:** The repository can advance independently of the workspace, and preserving those commits avoids overwriting the user's newer work.

**How to apply:** Treat a non-fast-forward rejection as a synchronization step, not a reason to replace the remote branch.

The managed GitHub push helper may report missing source-control credentials even when `GITHUB_PERSONAL_ACCESS_TOKEN` exists; an ephemeral `http.extraheader` Basic auth push is the fallback.

**Why:** The managed helper could not locate the connected source-control credential, while the workspace PAT successfully pushed the branch.

**How to apply:** Use the workspace secret only in memory with `http.extraheader`; never print it, put it in the remote URL, or persist it in Git config.