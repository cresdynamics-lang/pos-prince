#!/usr/bin/env bash
# Pull latest code, rebuild, and restart — keeps existing DB and secrets.
# Run as root: bash /home/prince/pos-prince/deploy/redeploy.sh
set -euo pipefail

APP_SRC="${APP_SRC:-/home/prince/pos-prince}"
APP_DIR="/opt/pos-prince"
DOMAIN_WEB="p-o-s.prince-esquire.co.ke"
DOMAIN_ALIASES="pos.prince-esquire.co.ke"
SERVER_IP="${SERVER_IP:-137.184.63.96}"
DOMAIN_API="${DOMAIN_API:-}"

log() { echo "[redeploy] $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

log "Pulling latest code..."
if [[ -d "${APP_SRC}/.git" ]]; then
  cd "${APP_SRC}"
  git pull --ff-only origin main
else
  git clone --depth 1 https://github.com/cresdynamics-lang/pos-prince.git "${APP_SRC}"
fi
chown -R prince:prince "${APP_SRC}"

BACKEND_ENV_BACKUP=""
DEPLOY_ENV_BACKUP=""
[[ -f "${APP_DIR}/backend/.env" ]] && BACKEND_ENV_BACKUP=$(mktemp) && cp "${APP_DIR}/backend/.env" "${BACKEND_ENV_BACKUP}"
[[ -f "${APP_DIR}/deploy/.env" ]] && DEPLOY_ENV_BACKUP=$(mktemp) && cp "${APP_DIR}/deploy/.env" "${DEPLOY_ENV_BACKUP}"

log "Syncing to ${APP_DIR}..."
mkdir -p "${APP_DIR}"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude backend/.env \
  --exclude deploy/.env \
  "${APP_SRC}/" "${APP_DIR}/"
chown -R prince:prince "${APP_DIR}"

[[ -n "${BACKEND_ENV_BACKUP}" && -f "${BACKEND_ENV_BACKUP}" ]] && cp "${BACKEND_ENV_BACKUP}" "${APP_DIR}/backend/.env" && rm -f "${BACKEND_ENV_BACKUP}"
[[ -n "${DEPLOY_ENV_BACKUP}" && -f "${DEPLOY_ENV_BACKUP}" ]] && cp "${DEPLOY_ENV_BACKUP}" "${APP_DIR}/deploy/.env" && rm -f "${DEPLOY_ENV_BACKUP}"

# Ensure CORS allows domain + IP access
if [[ -f "${APP_DIR}/backend/.env" ]]; then
  if ! grep -q "CORS_ORIGINS=.*${SERVER_IP}" "${APP_DIR}/backend/.env"; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN_WEB},https://${DOMAIN_ALIASES},http://${SERVER_IP}|" "${APP_DIR}/backend/.env" || true
  fi
fi

log "Ensuring Postgres + Redis are up..."
docker compose -f "${APP_DIR}/deploy/docker-compose.prod.yml" --env-file "${APP_DIR}/deploy/.env" up -d

log "Building API..."
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
API_PUBLIC_URL="/api/v1"
if [[ -n "${DOMAIN_API}" ]]; then
  API_PUBLIC_URL="https://${DOMAIN_API}/api/v1"
fi
cat > "${APP_DIR}/frontend/.env.production.local" <<EOF
NEXT_PUBLIC_API_URL=${API_PUBLIC_URL}
EOF
chown prince:prince "${APP_DIR}/frontend/.env.production.local"
sudo -u prince bash -c "cd '${APP_DIR}/frontend' && npm ci && NODE_OPTIONS='--max-old-space-size=768' npm run build"

log "Restarting services..."
cp "${APP_DIR}/deploy/prince-pos-api.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/prince-pos-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl restart prince-pos-api
sleep 3
systemctl restart prince-pos-web

log "Updating nginx..."
cp "${APP_DIR}/deploy/nginx-pos.conf" /etc/nginx/sites-available/${DOMAIN_WEB}
ln -sf /etc/nginx/sites-available/${DOMAIN_WEB} /etc/nginx/sites-enabled/${DOMAIN_WEB}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Health check..."
curl -fsS "http://127.0.0.1:8080/api/health" && echo ""
curl -fsS -H "Host: ${DOMAIN_WEB}" "http://127.0.0.1/api/health" && echo "" || curl -fsS "http://127.0.0.1/api/health" && echo ""

log "Done."
echo ""
echo "  IP:   http://${SERVER_IP}"
echo "  Web:  https://${DOMAIN_WEB} (when DNS is ready)"
echo "  API:  http://${SERVER_IP}/api/health"
echo "  Login: charles@prince-esquire.co.ke / C.Mutunga"
echo ""
systemctl is-active prince-pos-api prince-pos-web docker nginx
