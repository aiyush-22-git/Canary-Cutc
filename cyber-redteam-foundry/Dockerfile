FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Keep the expensive CPU torch layer independent of application source edits.
# This makes normal backend deployments reuse the 192 MB wheel layer.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "torch>=2.0.0" \
    --index-url https://download.pytorch.org/whl/cpu

# Copy application sources only after torch so code-only deployments are fast.
COPY src ./src
COPY configs ./configs
COPY prompts ./prompts

# Install the project (torch requirement already satisfied above)
RUN pip install --no-cache-dir -e .

ENV PYTHONPATH=/app:/app/src

EXPOSE 8001

CMD ["uvicorn", "cyberredteam.api:app", "--host", "0.0.0.0", "--port", "8001"]
