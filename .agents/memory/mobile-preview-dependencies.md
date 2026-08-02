---
name: Mobile preview dependencies
description: Environment requirement for starting the Expo mobile workflow.
---

The mobile preview workflow cannot start when workspace dependencies are absent; it fails before loading the app because the Expo command is unavailable.

**Why:** A checkout used for repository work may contain the mobile source but not `node_modules`, so preview failures can be environment setup issues rather than application errors.

**How to apply:** Before relying on the Expo preview for verification, confirm the workspace dependencies are installed and the mobile package can resolve its local Expo CLI.