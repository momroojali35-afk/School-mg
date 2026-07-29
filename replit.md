# School Management System

A pnpm monorepo for managing school operations — attendance, exams, fees, and more — for Dr. APJ Abdul Kalam Jatiya Vidyalaya.

## Stack

| Package | Tech |
|---|---|
| `artifacts/mobile` | React Native (Expo SDK 54), Expo Router, TanStack Query |
| `artifacts/api-server` | Node.js, Express, Drizzle ORM, PostgreSQL |
| `artifacts/mockup-sandbox` | React, Vite, Tailwind CSS v4 |
| `lib/api-spec` | OpenAPI definitions |
| `lib/api-client-react` | Generated React hooks from API spec |
| `lib/api-zod` | Shared Zod schemas |
| `lib/db` | Shared Drizzle database schema |

## Running the project

### Mobile app (web preview)
```
pnpm --filter @workspace/mobile run dev
```
Runs on port **18115**. Accessible in Replit preview pane.

### API server
Requires environment variables:
- `PORT` — port to listen on (e.g. `3000`)
- `APP_DATABASE_URL` — PostgreSQL connection string

```
pnpm --filter @workspace/api-server run dev
```

## Installing dependencies
```
pnpm install
```

## User preferences

- Keep the existing monorepo structure (pnpm workspaces).
