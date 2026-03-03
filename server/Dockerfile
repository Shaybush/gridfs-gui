# === BUILD ===
FROM python:3.12-slim AS build
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev

# === RUNNER ===
FROM python:3.12-slim AS runner
WORKDIR /app

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home --shell /bin/false appuser

ENV PYTHONUNBUFFERED=1

RUN mkdir -p /app/data && chown -R appuser:appgroup /app

COPY --from=build --chown=appuser:appgroup /app /app

USER appuser

VOLUME ["/app/data"]
EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
