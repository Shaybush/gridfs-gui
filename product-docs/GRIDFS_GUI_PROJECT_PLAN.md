# GridFS GUI — Project Plan

> A modern, open-source web GUI for managing MongoDB GridFS files.
> Think "S3 Console" but for GridFS.

---

## 1. Vision & Problem Statement

MongoDB GridFS is a powerful specification for storing large files, but it has **zero visual tooling**. Developers are forced to use CLI commands (`mongofiles`) or write custom scripts to manage files. This makes GridFS painful for teams that need to browse, search, upload, download, or organize files at scale.

**GridFS GUI** fills this gap — a self-hosted, Docker-ready web application that gives teams a familiar file-management experience on top of any MongoDB GridFS bucket.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Fast dev experience, strong ecosystem |
| **UI Library** | shadcn/ui + Tailwind CSS | Clean, modern look — S3-console feel |
| **State Mgmt** | Zustand (or React Query for server state) | Lightweight, no boilerplate |
| **Backend** | Node.js + Express + TypeScript | Same language as frontend, native MongoDB driver |
| **Database Driver** | `mongodb` (official Node.js driver) | First-class GridFS support via `GridFSBucket` |
| **Auth (optional)** | Basic Auth / JWT | Simple self-hosted auth layer |
| **Containerization** | Docker + Docker Compose | One-command deployment |
| **Testing** | Vitest (unit) + Playwright (e2e) | Fast, modern test tooling |
| **CI/CD** | GitHub Actions | Auto-build, test, push Docker image |

---

## 3. Core Features (MVP — v1.0)

### 3.1 Connection Manager
- Add / edit / delete MongoDB connection strings
- Support for standard URIs (`mongodb://`, `mongodb+srv://`)
- TLS/SSL toggle and optional CA certificate upload
- Connection health check (ping) with status indicator
- Persist connections in local config (encrypted at rest)
- Switch between connections at any time from a sidebar/dropdown

### 3.2 Bucket Browser
- List all GridFS buckets in the connected database (default: `fs`)
- Create new custom-named buckets
- Show bucket-level stats: total files, total size

### 3.3 File Explorer (the main screen)
- **Table view** with columns: Filename, Size, Content Type, Upload Date, Metadata
- **Grid/thumbnail view** for image-heavy buckets
- Sortable columns (name, date, size)
- Pagination with configurable page size (25 / 50 / 100)
- Multi-select with checkbox column

### 3.4 Search & Filter
- Full-text search on filename
- Filter by content type (dropdown or free text)
- Filter by date range (uploaded before/after)
- Filter by file size range
- Filter by custom metadata key-value pairs
- Save and name filter presets

### 3.5 File Operations
- **Upload**: Drag-and-drop zone + file picker, with progress bar; support multi-file upload; allow setting custom metadata on upload
- **Download**: Single file download; bulk download as ZIP
- **Preview**: Inline preview for images, PDFs, text, JSON, markdown, video, audio
- **Delete**: Single and bulk delete with confirmation modal
- **Rename**: Edit filename in place
- **Edit Metadata**: JSON editor for the file's `metadata` field
- **Copy/Move**: Copy or move files between buckets

### 3.6 File Detail Panel
- Slide-out panel or modal showing full file info
- Chunks breakdown (chunk count, chunk size)
- Raw GridFS document view (`files` and `chunks` collection entries)
- Download button, delete button, metadata editor

---

## 4. Extended Features (v1.1+)

| Feature | Description |
|---|---|
| **Folder simulation** | Virtual folders via `/` in filenames, with breadcrumb navigation |
| **Sharing** | Generate temporary signed URLs for file download |
| **Versioning view** | Show file versions if multiple uploads share a filename |
| **Activity log** | Track upload/delete/rename events (stored in a separate collection) |
| **Storage analytics** | Dashboard with charts — storage over time, top file types, largest files |
| **RBAC** | Role-based access control (admin, viewer, uploader) |
| **Webhooks** | Notify external systems on upload/delete events |
| **CLI companion** | `gridfs-gui-cli` for scripted uploads that register in the GUI |
| **Dark mode** | Toggle light/dark theme |

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                  │
│  ┌────────────┐ ┌───────────┐ ┌────────────────────────┐ │
│  │ Connection  │ │  Bucket   │ │    File Explorer       │ │
│  │  Manager    │ │  Sidebar  │ │  (table/grid + search) │ │
│  └──────┬─────┘ └─────┬─────┘ └───────────┬────────────┘ │
│         └──────────────┼──────────────────┘              │
│                        │ REST API calls                  │
└────────────────────────┼─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Node.js / Express API                    │
│                                                          │
│  /api/connections   — CRUD connections                   │
│  /api/buckets       — list / create buckets              │
│  /api/files         — list / search / upload / download  │
│  /api/files/:id     — detail / delete / rename / meta    │
│  /api/health        — server + DB health check           │
│                                                          │
│  ┌──────────────────────────────────────┐                │
│  │  ConnectionPool (per saved connection)│                │
│  │  → mongodb.GridFSBucket instances     │                │
│  └──────────────────────────────────────┘                │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │     MongoDB Instances    │
              │  (user's own databases)  │
              └─────────────────────────┘
```

---

## 6. API Design

### Connections

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/connections` | List all saved connections |
| POST | `/api/connections` | Add a new connection |
| PUT | `/api/connections/:id` | Update connection |
| DELETE | `/api/connections/:id` | Remove connection |
| POST | `/api/connections/:id/test` | Test connectivity |

### Buckets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/connections/:connId/buckets` | List buckets |
| POST | `/api/connections/:connId/buckets` | Create bucket |
| GET | `/api/connections/:connId/buckets/:name/stats` | Bucket statistics |

### Files

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/.../files` | List/search files (query params for filters, pagination, sort) |
| POST | `/api/.../files/upload` | Upload file(s) — multipart/form-data |
| GET | `/api/.../files/:id` | Get file metadata |
| GET | `/api/.../files/:id/download` | Stream file download |
| GET | `/api/.../files/:id/preview` | Preview (returns appropriate content-type) |
| DELETE | `/api/.../files/:id` | Delete file |
| PATCH | `/api/.../files/:id` | Rename / update metadata |
| POST | `/api/.../files/bulk-delete` | Bulk delete |
| POST | `/api/.../files/bulk-download` | Bulk download as ZIP |

---

## 7. Project Structure

```
gridfs-gui/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint + test on PR
│       └── release.yml             # build & push Docker image on tag
├── packages/
│   ├── client/                     # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/         # Sidebar, Header, AppShell
│   │   │   │   ├── connections/    # ConnectionForm, ConnectionList
│   │   │   │   ├── buckets/        # BucketSidebar, BucketStats
│   │   │   │   ├── files/          # FileTable, FileGrid, FileDetail
│   │   │   │   ├── upload/         # DropZone, UploadProgress
│   │   │   │   └── common/         # SearchBar, FilterPanel, ConfirmDialog
│   │   │   ├── hooks/              # useFiles, useConnections, useBuckets
│   │   │   ├── services/           # API client (axios/fetch wrappers)
│   │   │   ├── store/              # Zustand stores
│   │   │   ├── types/              # TypeScript interfaces
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── server/                     # Express backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── connections.ts
│       │   │   ├── buckets.ts
│       │   │   └── files.ts
│       │   ├── services/
│       │   │   ├── connection-pool.ts
│       │   │   ├── gridfs.service.ts
│       │   │   └── encryption.service.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── error-handler.ts
│       │   ├── config/
│       │   │   └── index.ts
│       │   ├── types/
│       │   └── app.ts
│       ├── tsconfig.json
│       └── package.json
├── docker/
│   ├── Dockerfile                  # Multi-stage: build client → serve with Node
│   └── docker-compose.yml          # For local development (with a test MongoDB)
├── docs/
│   ├── CONTRIBUTING.md
│   ├── screenshots/
│   └── api.md
├── .env.example
├── LICENSE                         # MIT
├── README.md
└── package.json                    # Workspace root (npm workspaces / turborepo)
```

---

## 8. Docker Strategy

### Dockerfile (multi-stage)

```dockerfile
# Stage 1 — Build frontend
FROM node:20-alpine AS client-build
WORKDIR /app/packages/client
COPY packages/client/package*.json ./
RUN npm ci
COPY packages/client/ ./
RUN npm run build

# Stage 2 — Build backend
FROM node:20-alpine AS server-build
WORKDIR /app/packages/server
COPY packages/server/package*.json ./
RUN npm ci
COPY packages/server/ ./
RUN npm run build

# Stage 3 — Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=server-build /app/packages/server/dist ./dist
COPY --from=server-build /app/packages/server/node_modules ./node_modules
COPY --from=client-build /app/packages/client/dist ./public
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/app.js"]
```

### docker-compose.yml (local dev)

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - ENCRYPTION_KEY=change-me-in-production
      - PORT=4000
    volumes:
      - gridfs-gui-data:/app/data   # persists connection configs

  mongo:    # optional test MongoDB
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  gridfs-gui-data:
  mongo-data:
```

### Publishing to Docker Hub

```yaml
# .github/workflows/release.yml
name: Release Docker Image
on:
  push:
    tags: ["v*"]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            yourname/gridfs-gui:latest
            yourname/gridfs-gui:${{ github.ref_name }}
          platforms: linux/amd64,linux/arm64
```

Users can then run:
```bash
docker run -d -p 4000:4000 yourname/gridfs-gui:latest
```

---

## 9. Development Milestones

### Phase 1 — Foundation (Week 1–2)
- [ ] Initialize monorepo (npm workspaces)
- [ ] Set up Express server with TypeScript
- [ ] Set up React + Vite + Tailwind + shadcn/ui
- [ ] Implement connection manager (backend + frontend)
- [ ] Connection persistence (encrypted JSON file or SQLite)

### Phase 2 — Core File Browsing (Week 3–4)
- [ ] Bucket listing and selection
- [ ] File listing endpoint with pagination
- [ ] File table component (sortable columns, pagination)
- [ ] File upload with drag-and-drop + progress
- [ ] Single file download (streaming)

### Phase 3 — Search, Filter & Preview (Week 5–6)
- [ ] Search bar (filename full-text)
- [ ] Filter panel (content type, date, size, metadata)
- [ ] File detail slide-out panel
- [ ] Inline preview (images, PDF, text, JSON, video, audio)
- [ ] Grid/thumbnail view toggle

### Phase 4 — Bulk Operations & Polish (Week 7–8)
- [ ] Multi-select + bulk delete
- [ ] Bulk download as ZIP
- [ ] Rename file + edit metadata (JSON editor)
- [ ] Copy/move between buckets
- [ ] Error handling, loading states, empty states
- [ ] Dark mode

### Phase 5 — Docker & Release (Week 9)
- [ ] Multi-stage Dockerfile
- [ ] Docker Compose for local dev
- [ ] GitHub Actions CI (lint, test, build)
- [ ] GitHub Actions release pipeline (push to Docker Hub / GHCR)
- [ ] Write README with screenshots, quick-start guide
- [ ] Tag `v1.0.0` and publish

### Phase 6 — Post-Launch (Ongoing)
- [ ] Virtual folder navigation
- [ ] Storage analytics dashboard
- [ ] RBAC / auth layer
- [ ] Community feedback + issue triage

---

## 10. Security Considerations

- **Connection strings are secrets** — encrypt at rest with AES-256, key from `ENCRYPTION_KEY` env var
- **No default MongoDB exposure** — the app connects to user-supplied URIs, never bundles a DB
- **Input validation** — sanitize all filenames, metadata keys, and query parameters
- **CORS** — locked to same-origin in production; configurable via env var for development
- **Auth** — optional basic auth or JWT; recommend enabling behind a reverse proxy in production
- **Docker** — run as non-root user in the container; no `--privileged`
- **Rate limiting** — apply to upload and delete endpoints to prevent abuse
- **CSP headers** — strict content security policy to prevent XSS

---

## 11. Open Source Setup

- **License**: MIT (maximum adoption)
- **Repository**: GitHub with Issues + Discussions enabled
- **CONTRIBUTING.md**: Code style, PR process, local setup guide
- **CODE_OF_CONDUCT.md**: Contributor Covenant
- **Issue templates**: Bug report, Feature request
- **README badges**: CI status, Docker pulls, license, version
- **Changelog**: Keep a CHANGELOG.md (or use GitHub Releases)

---

## 12. Competitive Landscape & Differentiation

| Existing Tool | Limitation | GridFS GUI Advantage |
|---|---|---|
| `mongofiles` CLI | No GUI, no search, no preview | Full web UI with search, preview, filters |
| MongoDB Compass | Can browse collections but has no GridFS-specific view | Purpose-built for GridFS with upload/download/preview |
| Custom scripts | One-off, not reusable | Reusable, Dockerized, shareable |
| NoSQLBooster | Paid, not GridFS-focused | Free, open-source, GridFS-first |

---

*This plan is a living document. Adjust timelines and priorities based on community feedback after the initial release.*
