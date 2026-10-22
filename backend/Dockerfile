FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# sentence-transformers pulls in torch, which needs a few system libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Optional zero-shot photo classification. Build with
#   docker build --build-arg INSTALL_CLIP=1 .
# to add the CLIP checkpoint support (about 2 GB of image).
ARG INSTALL_CLIP=0
RUN if [ "$INSTALL_CLIP" = "1" ]; then \
      pip install --no-cache-dir "transformers>=4.40" torch; \
    fi

COPY app ./app
COPY scripts ./scripts

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${PORT:-8000}"]
