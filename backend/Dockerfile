FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY requirements.txt ./
RUN python3 -m venv /opt/music-venv && /opt/music-venv/bin/pip install --no-cache-dir -r requirements.txt
COPY server.py youtube.mjs ./
ENV PORT=8787
EXPOSE 8787
CMD ["/opt/music-venv/bin/python", "server.py"]
