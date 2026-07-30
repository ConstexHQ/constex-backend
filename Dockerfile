FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

CMD ["node", "server.js"]
