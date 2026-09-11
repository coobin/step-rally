FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/api/package*.json apps/api/

RUN npm install

COPY . .
RUN npm --workspace apps/web run build

FROM node:20

WORKDIR /app
ENV NODE_ENV=production \
    BIND_HOST=0.0.0.0 \
    PORT=8095 \
    PUBLIC_DIR=/app/public \
    DATA_FILE=/app/data/rally.json \
    TZ=Asia/Shanghai

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./public

RUN mkdir -p /app/data

EXPOSE 8095

CMD ["npx", "tsx", "apps/api/src/server.ts"]
