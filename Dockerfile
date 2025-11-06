FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Instala dependências do backend
COPY backend/requirements.txt backend/requirements.txt
RUN python -m venv /opt/venv \
    && pip install --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt

# Copia o backend para a imagem
COPY backend backend

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
