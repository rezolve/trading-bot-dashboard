FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot runtime
COPY ../../runtime/movers_day.py /app/movers_day.py

# Environment variables (set via compose)
ENV APCA_API_BASE_URL=""
ENV APCA_API_KEY_ID=""
ENV APCA_API_SECRET_KEY=""
ENV USER_ID=""
ENV FIRESTORE_EMULATOR_HOST=""

CMD ["python", "movers_day.py"]
