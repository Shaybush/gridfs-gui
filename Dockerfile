# Stage 1 -- Frontend build
FROM node:20-alpine AS frontend-build

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app/gui

COPY gui/package.json gui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY gui/ ./

# Empty VITE_API_URL so the frontend uses relative URLs in production
ENV VITE_API_URL=

RUN pnpm build

# Stage 2 -- Backend dependency resolution
FROM python:3.12-slim AS backend-build

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY server/ ./
RUN uv sync --frozen --no-dev

# Stage 3 -- Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home --shell /bin/false appuser

COPY --from=backend-build --chown=appuser:appgroup /app /app
COPY --from=frontend-build --chown=appuser:appgroup /app/gui/dist /app/public

ENV PYTHONUNBUFFERED=1

RUN mkdir -p /app/data && chown appuser:appgroup /app/data

USER appuser

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
