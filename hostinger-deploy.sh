#!/bin/bash
# ──────────────────────────────────────────────
# RB Jewelry — Hostinger Deployment Script
# Run this on your LOCAL machine, not on Hostinger
# ──────────────────────────────────────────────

set -e

REMOTE_USER="your_ssh_user"        # e.g. u123456789
REMOTE_HOST="your_domain.com"      # your Hostinger domain or IP
REMOTE_DIR="~/public_html"         # or ~/domains/rbjewelry.co/public_html

echo "📦 Building Next.js standalone..."
npm run build

echo "🗜  Packaging files..."
tar -czf rb-deploy.tar.gz \
  .next/standalone \
  .next/static \
  public \
  prisma \
  package.json \
  start.js

echo "⬆️  Uploading to Hostinger..."
scp rb-deploy.tar.gz $REMOTE_USER@$REMOTE_HOST:~/rb-deploy.tar.gz

echo "🔧 Setting up on server..."
ssh $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
  cd ~
  tar -xzf rb-deploy.tar.gz -C public_html --strip-components=0
  cd public_html

  # Copy static assets into standalone
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public

  # Install dependencies if needed
  cd .next/standalone
  npm install --omit=dev 2>/dev/null || true

  # Run Prisma migrations
  npx prisma db push --skip-generate 2>/dev/null || echo "DB push skipped — run manually"

  # Restart via PM2 (if available) or kill old process
  if command -v pm2 &> /dev/null; then
    pm2 restart rb-jewelry 2>/dev/null || pm2 start ~/public_html/start.js --name rb-jewelry
    pm2 save
  else
    echo "PM2 not found — start manually: node start.js"
  fi

  echo "✅ Deployed!"
ENDSSH

rm -f rb-deploy.tar.gz
echo "🎉 Done. Visit your domain to confirm."
