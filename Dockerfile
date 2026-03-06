# Stage 1 -- Frontend build
FROM node:20-slim AS frontend-build

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app/gui

COPY gui/package.json gui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN pnpm add -D esbuild || true

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
    useradd --uid 1001 --gid appgroup --create-home --home-dir /home/appuser --shell /bin/false appuser

ENV PYTHONUNBUFFERED=1

# Install LibreOffice headless for document-to-PDF conversion (before COPY for better layer caching)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        libreoffice-common \
        fonts-liberation \
        fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=backend-build --chown=appuser:appgroup /app /app
COPY --from=frontend-build --chown=appuser:appgroup /app/gui/dist /app/public

RUN mkdir -p /app/data && chown appuser:appgroup /app/data

# LibreOffice needs writable directories for its user profile and dconf cache
RUN mkdir -p /tmp/libreoffice-profile /home/appuser/.cache/dconf && \
    chown -R appuser:appgroup /home/appuser /tmp/libreoffice-profile

USER appuser

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
