---
name: API database startup
description: The startup ordering required for API routes that use the database adapter
---

The API server must await database-manager initialization before calling `app.listen`. Otherwise the process can accept requests while the active adapter is still null, causing database-backed routes such as Alumni import to fail or expose misleading persistence errors.

**Why:** A server bundle can start and return health responses even when no database adapter has been initialized. This made the Alumni screen appear to fail during import even though its payload and current adapter mapping were correct.

**How to apply:** Keep database initialization in the API entrypoint before the listener starts. If the saved connection cannot be restored, allow the manager’s configured environment-database fallback to initialize before serving requests.