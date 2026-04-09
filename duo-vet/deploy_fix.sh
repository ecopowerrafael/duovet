#!/bin/bash
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "Deployment fix applied."
cat /etc/nginx/sites-available/duovet | grep Content-Security-Policy
