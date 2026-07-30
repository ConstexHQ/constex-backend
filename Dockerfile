FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

ENV PORT=10000
ENV DATA_DIR=/tmp/constex-data

EXPOSE 10000

CMD ["node", "server.js"]
