FROM node:18-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 8080
CMD ["node", "server.js"]
