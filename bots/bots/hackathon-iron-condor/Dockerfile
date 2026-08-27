FROM python:3.11-slim

WORKDIR /app

# Copy runtime and strategies
COPY runtime/ /app/runtime/
COPY strategies/ /app/strategies/

# Copy bot-specific files
COPY bots/hackathon-iron-condor/ /app/bot/

# Install dependencies
RUN pip install --no-cache-dir -r /app/runtime/requirements.txt

# Set environment
ENV PYTHONUNBUFFERED=1
ENV BOT_ID=hackathon-iron-condor
ENV COMPETITION_ACCOUNT=true

# Run bot
CMD ["python", "/app/bot/main.py"]
