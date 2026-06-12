# Ledger API — production container image.
# Used when deploying to Railway / Fly.io / Render / any container host.
# For local dev, `uvicorn app.main:app --reload` is faster than Docker.

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer when only app code changes).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app
COPY scripts ./scripts

# Persistent volume mount point. On Railway/Fly attach a volume here and
# point DATABASE_URL at sqlite:////data/finance.db. On Postgres hosts
# the volume is unnecessary.
VOLUME ["/data"]

EXPOSE 8000

# Bind to 0.0.0.0 so the container is reachable from outside.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
