#!/usr/bin/env bash
# Full server wipe + fresh POS install. Run as root:
#   bash /home/prince/pos-prince/deploy/clean-install.sh
set -euo pipefail

log() { echo "[clean] $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

log "Stopping services..."
systemctl stop prince-pos-api prince-pos-web 2>/dev/null || true
systemctl disable prince-pos-api prince-pos-web 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
pkill -f '/var/www/pos-backend' 2>/dev/null || true
pkill -f 'pos-backend/dist/server.js' 2>/dev/null || true
pkill -f 'next-server' 2>/dev/null || true

log "Removing old app files..."
rm -rf /opt/pos-prince
rm -rf /var/www/pos-backend
rm -rf /home/prince/pos-prince
rm -rf /home/prince/.pm2
rm -f /etc/systemd/system/prince-pos-api.service
rm -f /etc/systemd/system/prince-pos-web.service
systemctl daemon-reload

log "Removing Docker containers, volumes, and build cache..."
docker rm -f prince-pos-postgres prince-pos-redis 2>/dev/null || true
docker rm -f $(docker ps -aq) 2>/dev/null || true
docker compose -f /opt/pos-prince/deploy/docker-compose.prod.yml down -v 2>/dev/null || true
docker volume rm deploy_prince_pos_pg 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
docker image prune -af 2>/dev/null || true

log "Cloning fresh code from GitHub..."
git clone --depth 1 https://github.com/cresdynamics-lang/pos-prince.git /home/prince/pos-prince
chown -R prince:prince /home/prince/pos-prince

log "Running install..."
bash /home/prince/pos-prince/deploy/install.sh
