#!/usr/bin/env bash
# Run as root on pos-server: bash /home/prince/pos-prince/deploy/install.sh
set -euo pipefail

APP_SRC="${APP_SRC:-/home/prince/pos-prince}"
APP_DIR="/opt/pos-prince"
DOMAIN_WEB="pos.prince-esquire.co.ke"
DOMAIN_API="pos-api.prince-esquire.co.ke"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
if [[ -z "${POSTGRES_PASSWORD}" && -f /opt/pos-prince/deploy/.env ]]; then
  # shellcheck disable=SC1091
  source /opt/pos-prince/deploy/.env
fi
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 16)}"

log() { echo "[install] $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

log "Stopping old deployment..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
pkill -f '/var/www/pos-backend' 2>/dev/null || true
pkill -f 'pos-backend/dist/server.js' 2>/dev/null || true
systemctl stop prince-pos-api 2>/dev/null || true
systemctl stop prince-pos-web 2>/dev/null || true
rm -rf /var/www/pos-backend

log "Installing packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 golang-go nginx certbot python3-certbot-nginx postgresql-client curl

if ! swapon --show | grep -q /swapfile; then
  log "Adding 2G swap for build..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

systemctl enable --now docker
usermod -aG docker prince || true

log "Syncing application to ${APP_DIR}..."
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}"
if [[ -d "${APP_SRC}" ]]; then
  rsync -a --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    "${APP_SRC}/" "${APP_DIR}/"
else
  git clone --depth 1 https://github.com/cresdynamics-lang/pos-prince.git "${APP_DIR}"
fi
chown -R prince:prince "${APP_DIR}"

log "Starting Postgres + Redis..."
cat > "${APP_DIR}/deploy/.env" <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF
docker compose -f "${APP_DIR}/deploy/docker-compose.prod.yml" --env-file "${APP_DIR}/deploy/.env" up -d

DB_URL="postgres://prince:${POSTGRES_PASSWORD}@127.0.0.1:5432/prince_pos?sslmode=disable"
log "Waiting for Postgres..."
for i in $(seq 1 60); do
  if docker exec prince-pos-postgres pg_isready -U prince -d prince_pos >/dev/null 2>&1; then
    if psql "${DB_URL}" -c "SELECT 1" >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done
if ! psql "${DB_URL}" -c "SELECT 1" >/dev/null 2>&1; then
  echo "Postgres failed to become ready"
  docker logs prince-pos-postgres --tail 30
  exit 1
fi

log "Running migrations..."
for f in \
  001_initial_schema.sql \
  002_seed_categories.sql \
  003_auth_permissions.sql \
  005_discounts.sql \
  006_checkout.sql \
  007_expenses.sql \
  008_daily_notes.sql \
  009_subcategory_products.sql
do
  log "  -> ${f}"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${APP_DIR}/backend/migrations/${f}"
done

log "Writing backend .env..."
cat > "${APP_DIR}/backend/.env" <<EOF
PORT=8080
DATABASE_URL=${DB_URL}
REDIS_URL=redis://127.0.0.1:6380
JWT_SECRET=${JWT_SECRET}
CORS_ORIGINS=https://${DOMAIN_WEB}
BOOTSTRAP_ADMIN_EMAIL=charles@prince-esquire.co.ke
BOOTSTRAP_ADMIN_PASSWORD=C.Mutunga
BOOTSTRAP_ADMIN_NAME=Charles Mutunga
EOF
chown prince:prince "${APP_DIR}/backend/.env"
chmod 600 "${APP_DIR}/backend/.env"

log "Building API (Go via Docker)..."
cd "${APP_DIR}/backend"
docker build -t prince-pos-api-build .
docker rm -f prince-api-extract 2>/dev/null || true
cid=$(docker create --name prince-api-extract prince-pos-api-build)
mkdir -p bin
docker cp "${cid}:/app/server" bin/server
docker rm prince-api-extract
chmod +x bin/server
chown prince:prince bin/server

log "Building frontend..."
cat > "${APP_DIR}/frontend/.env.production.local" <<EOF
NEXT_PUBLIC_API_URL=https://${DOMAIN_API}/api/v1
EOF
chown prince:prince "${APP_DIR}/frontend/.env.production.local"
sudo -u prince bash -c "cd '${APP_DIR}/frontend' && npm ci && NODE_OPTIONS='--max-old-space-size=768' npm run build"

log "Installing systemd services..."
cp "${APP_DIR}/deploy/prince-pos-api.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/prince-pos-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable prince-pos-api prince-pos-web
systemctl restart prince-pos-api
sleep 3
systemctl restart prince-pos-web

log "Configuring nginx..."
cp "${APP_DIR}/deploy/nginx-pos.conf" /etc/nginx/sites-available/${DOMAIN_WEB}
cp "${APP_DIR}/deploy/nginx-pos-api.conf" /etc/nginx/sites-available/${DOMAIN_API}
ln -sf /etc/nginx/sites-available/${DOMAIN_WEB} /etc/nginx/sites-enabled/${DOMAIN_WEB}
ln -sf /etc/nginx/sites-available/${DOMAIN_API} /etc/nginx/sites-enabled/${DOMAIN_API}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Issuing SSL certificates..."
certbot --nginx -d "${DOMAIN_WEB}" -d "${DOMAIN_API}" --non-interactive --agree-tos -m prince-esquire@gmail.com --redirect || true

log "Done."
echo ""
echo "  Web:  https://${DOMAIN_WEB}"
echo "  API:  https://${DOMAIN_API}/api/health"
echo "  Login: charles@prince-esquire.co.ke / C.Mutunga"
echo ""
systemctl is-active prince-pos-api prince-pos-web docker nginx
curl -fsS "http://127.0.0.1:8080/api/health" && echo ""
