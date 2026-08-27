# --- Single-stage image, cukup simpel untuk MVP ---
FROM node:20-alpine
# tzdata WAJIB — tanpa ini env TZ diabaikan (container tetap UTC, tanggal mundur).
RUN apk add --no-cache libc6-compat openssl tzdata
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Naikin heap Node — build Next + font di mesin 2core/4GB bisa OOM di default (~2GB).
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
