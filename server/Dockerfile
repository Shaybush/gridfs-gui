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

ENV PYTHONUNBUFFERED=1

COPY --from=build /app /app

EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
