# ClickUp Clone

Two folders, two jobs:

- **`backend/`** — Node.js + Express API and the MongoDB database layer. Everything database-related lives here.
- **`frontend/`** — React UI. Talks to the API only; no database code in this folder.

If you only care about the database, you never need to open `frontend/`.

## Database — start here

| What | File |
|---|---|
| DB connection (reads `MONGODB_URI`) | `backend/src/db.ts` |
| Connection string / secrets | `backend/.env` |
| Schemas (one file per MongoDB collection) | `backend/src/models/` |

### Collections

| File | Collection | Fields |
|---|---|---|
| `models/User.ts` | `users` | email, passwordHash, fullName, company |
| `models/Workspace.ts` | `workspaces` | name, ownerId, members[] (userId, role, joinedAt) |
| `models/Project.ts` | `projects` | workspaceId, name, color, createdBy |
| `models/Task.ts` | `tasks` | workspaceId, projectId, name, description, status, priority, dueDate, assigneeId, createdBy |
| `models/WorkspaceInvite.ts` | `workspaceinvites` | workspaceId, email, role, token, invitedBy, expiresAt |

### Everything else in `backend/src/`

| Folder | Purpose |
|---|---|
| `routes/` | API endpoints — one file per resource (`auth`, `workspaces`, `projects`, `tasks`, `invites`). These call into `models/` to read/write MongoDB. |
| `services/` | Logic that isn't a straight DB read/write (password hashing, sending invite emails). |
| `middleware/` | Auth checks that run before a route handler (`requireAuth`, `requireWorkspaceMember`). |
| `utils/` | Small shared helpers (e.g. formatting a MongoDB doc for JSON responses). |
| `index.ts` | App entry point — connects to the DB, then starts the server. |

## Running it

```
# Terminal 1 — backend + database connection
cd backend
npm run dev        # http://localhost:3001

# Terminal 2 — frontend
cd frontend
npm run dev         # http://localhost:5173
```

MongoDB itself runs as a background Windows service (`MongoDB`, auto-starts), database name `clickup-clone`. To browse it visually, open **MongoDB Compass** and connect to `mongodb://localhost:27017/clickup-clone`.
