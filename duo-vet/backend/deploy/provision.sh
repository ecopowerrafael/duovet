#!/usr/bin/env bash
set -euxo pipefail
apt update
apt install -y curl unzip nginx
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
npm install -g pm2
ufw allow 80/tcp || true
ufw allow 443/tcp || true
mkdir -p /var/www/duovet
if [ -f /root/dist.zip ]; then
  unzip -o /root/dist.zip -d /var/www/duovet
fi
if [ ! -f /var/www/duovet/index.html ]; then
  printf '%s' '<!doctype html><html><head><meta charset="utf-8"><title>DuoVet</title></head><body><h1>DuoVet online</h1></body></html>' >/var/www/duovet/index.html
fi
mkdir -p /opt/duovet/backend
if [ -f /root/backend.zip ]; then
  unzip -o /root/backend.zip -d /opt/duovet/backend
fi
cd /opt/duovet/backend
if [ ! -d node_modules ]; then
  npm install || true
fi
if [ -f /root/ecosystem.config.js ]; then
  pm2 start /root/ecosystem.config.js
else
  pm2 start index.js --name duovet-api
fi
pm2 save
pm2 startup systemd -u root --hp /root
if [ -f /root/duovet.nginx.conf ]; then
  mv /root/duovet.nginx.conf /etc/nginx/sites-available/duovet
fi
rm -f /etc/nginx/sites-enabled/default || true
ln -sf /etc/nginx/sites-available/duovet /etc/nginx/sites-enabled/duovet
nginx -t
systemctl reload nginx
ss -tlnp | grep ':80' || true
ss -tlnp | grep ':4000' || true
curl -I http://127.0.0.1 || true
curl -I http://127.0.0.1:4000 || true
