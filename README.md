# ClickUp Clone

A task-and-project manager for small teams. Create tasks, organize them in
**lists** and a **kanban board**, see deadlines on a **calendar**, track progress
on a **dashboard**, and invite teammates into shared **workspaces**.

Built as a learning project — not affiliated with ClickUp.

---

## Tech stack

| Part | Stack |
|------|-------|
| **Frontend** (`frontend/`) | React 19, Vite, TypeScript, Tailwind CSS, Zustand (state), React Router, React Hook Form + Zod |
| **Backend** (`backend/`) | Node.js, Express 5, TypeScript, MongoDB (via Mongoose), JWT auth, Nodemailer |

The frontend is a static site that talks to the backend over HTTP. The backend
owns all data and talks to MongoDB. They run as two separate servers.

---

## Running it locally

**You need:** Node.js 18+, and MongoDB running locally (default
`mongodb://localhost:27017`).

```bash
# 1. Backend  (terminal 1)
cd backend
cp .env.example .env      # then open .env and fill in the values
npm install
npm run dev               # → http://localhost:3001

# 2. Frontend  (terminal 2)
cd frontend
cp .env.example .env
npm install
npm run dev               # → http://localhost:5173
```

Open **http://localhost:5173** and create an account.

### Building for production

```bash
cd backend  && npm run build && npm start      # runs dist/index.js
cd frontend && npm run build                    # static files in dist/
```

---

## Environment variables

### `backend/.env`

| Variable | What it's for |
|----------|---------------|
| `JWT_SECRET` | Signs login tokens. **Must** be a long random string in production (the server refuses to start otherwise). Generate one with `openssl rand -base64 48`. |
| `MONGODB_URI` | MongoDB connection string. |
| `FRONTEND_URL` | Where the frontend is hosted. Used in invite links and as the default CORS allow-list. |
| `CORS_ORIGINS` | *(optional)* Comma-separated list of allowed browser origins. Overrides `FRONTEND_URL` for CORS. |
| `NODE_ENV` | Set to `production` when deploying. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | *(optional)* Gmail account used to send invite emails. Without these, invites still work via the "copy link" button. |

### `frontend/.env`

| Variable | What it's for |
|----------|---------------|
| `VITE_API_URL` | Base URL of the backend. Baked in at build time. Defaults to `http://localhost:3001`. |

---

## Project map

### `backend/src/`

| Path | What lives here |
|------|-----------------|
| `index.ts` | App entry point. Sets up Express, security middleware, routes, then starts the server. |
| `config.ts` | Reads env vars, validates `JWT_SECRET`, connects to MongoDB. |
| `models/` | One file per MongoDB collection: `User`, `Workspace`, `Project`, `Task`, `WorkspaceInvite`, `AuditLog`. Defines the shape of each document. |
| `routes/` | The API endpoints, one file per topic: `auth` (signup/login), `workspaces` (members, invites, activity), `tasks`, `projects`, `invites` (accepting an invite). |
| `middleware/` | Runs before a route: `requireAuth` (valid login token) and `requireWorkspaceMember` (you belong to this workspace). |
| `services/` | Logic that isn't a plain DB call: `userService` (password hashing), `emailService` (sending mail), `auditService` (writing to the activity log). |
| `utils/serialize.ts` | Turns MongoDB documents into clean `{ id, ... }` JSON. |

### `frontend/src/`

| Path | What lives here |
|------|-----------------|
| `main.tsx` | Boots React and wires the API client to the auth store. |
| `App.tsx` | The route table (which URL shows which page). |
| `pages/` | One component per screen: `LandingPage`, `AuthPage` (login + signup), `InviteAcceptPage`, and the in-app screens `ListPage`, `KanbanPage`, `CalendarPage`, `DashboardPage`, `UsersPage`. |
| `components/` | Reusable pieces. `AppShell` / `AppSidebar` / `AppTopbar` are the app frame; the rest are modals, panels, and small widgets. `components/Landing/` holds the marketing homepage sections. |
| `store/` | Zustand stores (app state): `authStore` (who's logged in, multi-account), `workspaceStore` (current workspace, members, invites, activity), `taskStore` (tasks + projects), `uiStore` (modals, toasts). |
| `utils/` | Helpers: `api.ts` (all backend calls), `authGuards.tsx` (route protection), `authValidation.ts` (form rules), `types.ts` (shared TypeScript types), plus small formatters. |

---

## Where do I change…

| I want to… | Look in |
|------------|---------|
| add or change an API endpoint | `backend/src/routes/` |
| change what a document stores | `backend/src/models/` |
| change a screen's layout | `frontend/src/pages/` |
| change app-wide state / data fetching | `frontend/src/store/` |
| change colors / spacing | `frontend/tailwind.config.js` and `frontend/src/index.css` |
| change the marketing homepage | `frontend/src/components/Landing/` |
