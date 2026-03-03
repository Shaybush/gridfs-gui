# GridFS GUI

A modern web-based GUI for browsing, managing, and previewing files stored in MongoDB GridFS.

## Features

- **Connection Manager** — Save and manage multiple MongoDB connections with encrypted storage (AES-256)
- **Multi-database & Bucket Browsing** — Navigate across databases and GridFS buckets from a single interface
- **File Upload** — Drag-and-drop upload with progress tracking, metadata support, multi-file batching
- **File Preview** — In-browser preview for images, PDFs, text/code files, video, and audio
- **Search & Filter** — Filter files by filename, content type, upload date range, file size, and custom metadata
- **Table & Grid Views** — Switch between sortable table view and thumbnail grid view
- **Bulk Operations** — Select multiple files for bulk delete or bulk download as ZIP
- **File Management** — Rename files, edit metadata, copy or move files between buckets
- **Dark Mode** — Full dark mode support with system preference detection
- **Single-image Docker** — One image, one port (8000) serves both the UI and the API

## Quick Start

Requirements: Docker.

### Option 1 — Single container (simplest)

```bash
docker run -d \
  -p 8000:8000 \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -v gridfs-gui-data:/app/data \
  shaybushary/gridfs-gui
```

Open http://localhost:8000 in your browser. Port 8000 serves both the React UI and the REST API.

### Option 2 — Full stack with MongoDB (docker-compose)

```bash
# Clone the repository
git clone https://github.com/shaybushary/gridfs-gui.git
cd gridfs-gui

# Copy and configure environment variables
cp .env.example .env
# Edit .env and set ENCRYPTION_KEY (required — see Environment Variables below)

# Start the production stack (pre-built image + MongoDB)
docker compose -f docker-compose.prod.yml up -d
```

Open http://localhost:8000 in your browser.

### Generating an Encryption Key

The `ENCRYPTION_KEY` must be a 64-character hex string (256-bit key):

```bash
openssl rand -hex 32
```

Copy the output into your `.env` file as the value for `ENCRYPTION_KEY`.

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- MongoDB (local or remote)

### Backend

```bash
cd server
uv sync
uv run uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

### Frontend

```bash
cd gui
pnpm install
pnpm dev
```

The GUI will be available at http://localhost:3004.

### Running Both Together

Open two terminal windows and run the backend and frontend commands above in parallel.

### Building the Unified Image Locally

```bash
# Convenience script — builds frontend then copies output into server/public/
./build.sh

# Or build the Docker image directly from the project root
docker build -t gridfs-gui .
```

## Environment Variables

All environment variables are consumed by the **server** service.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8000` | FastAPI listen port |
| `HOST` | No | `0.0.0.0` | FastAPI bind host |
| `DEBUG` | No | `false` | Enable debug/reload mode |
| `APP_NAME` | No | `gridfs-gui` | Application name (shown in logs) |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed CORS origins |
| `ENCRYPTION_KEY` | **Yes** | — | 64-char hex string used for AES-256 encryption of stored connection URIs |
| `DATA_DIR` | No | `./data` | Directory for persistent data (connections store) |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| UI Components | Tailwind CSS v4, shadcn/ui, Radix UI |
| Backend | FastAPI (Python 3.12) |
| Async DB Driver | Motor (async MongoDB) |
| Package Management | pnpm (frontend), uv (backend) |
| Database | MongoDB 7 / GridFS |
| Containerization | Docker (single image, single port) |

## Project Structure

```
gridfs-gui/
├── gui/                # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/ # UI components (files, connections, layout, ui)
│   │   ├── pages/      # Route-level page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── contexts/   # React contexts (active connection, theme)
│   │   └── common/     # Shared utilities, types, constants
│   └── Dockerfile      # Standalone nginx image (dev/legacy)
├── server/             # FastAPI backend (Python)
│   ├── app/
│   │   ├── api/        # Route handlers (connections, buckets, files)
│   │   ├── models/     # Pydantic request/response models
│   │   └── services/   # Business logic (GridFS, encryption, connection pool)
│   ├── main.py
│   └── Dockerfile      # Standalone server image (dev/legacy)
├── Dockerfile          # Unified multi-stage image (frontend + backend, port 8000)
├── build.sh            # Local build helper: builds frontend, copies to server/public/
├── docker-compose.yml      # Dev stack (builds from source, separate gui/server/mongo)
├── docker-compose.prod.yml # Prod stack (pre-built image + mongo)
├── .env.example
└── render.yaml
```

## Screenshots
<img width="1512" height="762" alt="image" src="https://github.com/user-attachments/assets/4d7d7e63-eea7-4dc1-9796-30162174b2d4" />
<img width="1020" height="623" alt="image" src="https://github.com/user-attachments/assets/3767394e-564e-43bb-9029-aca0b2a215a4" />


## License

MIT
