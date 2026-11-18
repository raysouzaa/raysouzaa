FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY config.json ./
VOLUME ["/app/data"]
USER node
CMD ["node", "src/index.js"]
