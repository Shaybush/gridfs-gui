# Contributing to GridFS GUI

Thank you for your interest in contributing. This document covers the workflow, code style expectations, and local setup.

## Workflow

1. Fork the repository and clone your fork.
2. Create a feature branch off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or for bug fixes:
   git checkout -b fix/short-description
   ```
3. Make your changes, following the code style guidelines below.
4. Push your branch and open a Pull Request against `main`.
5. Ensure all CI checks pass before requesting review.

## Local Setup

### Prerequisites

- Node.js 20+, pnpm (`npm install -g pnpm`)
- Python 3.12+, uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Docker + Docker Compose (optional, for full-stack testing)
- A running MongoDB instance

### Backend

```bash
cd server
uv sync
cp ../.env.example ../.env
# Set ENCRYPTION_KEY in .env (generate with: openssl rand -hex 32)
uv run uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd gui
pnpm install
pnpm dev
```

## Code Style

### Frontend

- **Linter**: ESLint with TypeScript rules (`pnpm lint`)
- **Formatter**: Biome (`pnpm format`)
- Use TypeScript strict mode — no `any` types without justification.
- Components live under `src/components/<feature>/`, pages under `src/pages/<Page>/`.
- Custom hooks live under `src/hooks/`. Keep hooks focused on a single concern.
- Use shadcn/ui primitives for all new UI elements. Do not introduce new component libraries.

### Backend

- Follow FastAPI project conventions: routers in `app/api/`, services in `app/services/`, Pydantic models in `app/models/`.
- All endpoints must have Pydantic request/response models.
- Use `app/api/deps.py` for shared FastAPI dependencies.
- Run `uv run pytest` before submitting a PR.
- Keep services stateless where possible (state lives in the connection pool singleton or on disk in `DATA_DIR`).

## Pull Request Process

1. Every PR must pass CI (lint, test, build) before merge.
2. Keep PRs focused — one feature or fix per PR.
3. Add or update tests for new functionality.
4. Update `docs-claude/backend-routes.md` when adding new API endpoints.
5. PRs are merged by maintainers after approval.

## Reporting Issues

Use the GitHub Issue tracker. Select the appropriate template (bug report or feature request) and fill in all sections.
