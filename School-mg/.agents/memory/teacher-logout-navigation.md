---
name: Teacher logout navigation
description: Teacher sign-out must avoid competing redirects while auth state clears
---

Teacher sign-out clears the auth session before navigating to login, and the teacher dashboard must suppress its unauthenticated redirect effect during that explicit transition.

**Why:** Competing route replacements while the nested teacher stack is unmounting can surface the app error boundary instead of the login screen.

**How to apply:** Keep logout navigation owned by the sign-out handler; use a local transition guard in the teacher dashboard rather than adding a global auth redirect that races with it.