#!/bin/sh
set -e

echo "==> Sinkronisasi schema database (prisma db push)"
npx prisma db push --skip-generate --accept-data-loss

echo "==> Seed data awal (admin, kasir, contoh menu & kemasan)"
npm run db:seed || echo "(seed dilewati / sudah ada)"

echo "==> Menjalankan aplikasi"
exec npm run start
