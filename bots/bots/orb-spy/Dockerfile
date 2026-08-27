FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot runtime
COPY bots/runtime/orb_sip_ws.py /app/orb_sip_ws.py

# Environment variables (override in docker-compose or runtime)
ENV APCA_API_BASE_URL=https://paper-api.alpaca.markets
ENV APCA_API_KEY_ID=""
ENV APCA_API_SECRET_KEY=""

# PAPER ONLY - will refuse to start if BASE_URL doesn't contain 'paper'
CMD ["python", "-u", "orb_sip_ws.py"]
