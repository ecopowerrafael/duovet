import paramiko
import os

VPS_IP = '187.77.43.105'
VPS_USER = 'root'
VPS_PASS = '2705#Data2705'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {VPS_IP}...")
    ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
    
    # 1. Update files on VPS
    sftp = ssh.open_sftp()
    
    # Update upload.js
    local_upload = r'c:\Users\Code\OneDrive\Documentos\duo-vet\duo-vet\backend\upload.js'
    remote_upload = '/var/www/duovet/backend/upload.js'
    print(f"Uploading {local_upload}...")
    sftp.put(local_upload, remote_upload)
    
    # Update Nginx config
    local_nginx = r'c:\Users\Code\OneDrive\Documentos\duo-vet\duo-vet\backend\deploy\duovet.nginx.conf'
    remote_nginx = '/var/www/duovet/backend/deploy/duovet.nginx.conf'
    print(f"Uploading {local_nginx}...")
    sftp.put(local_nginx, remote_nginx)
    
    sftp.close()
    
    # 2. Apply Nginx changes
    print("Applying Nginx configuration...")
    nginx_cmd = "cp /var/www/duovet/backend/deploy/duovet.nginx.conf /etc/nginx/sites-available/duovet && nginx -t && systemctl reload nginx"
    stdin, stdout, stderr = ssh.exec_command(nginx_cmd)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Nginx Stderr: {err}")
    
    # 3. Restart PM2
    print("Restarting PM2...")
    stdin, stdout, stderr = ssh.exec_command('cd /var/www/duovet/backend && pm2 restart ecosystem.config.js')
    print(stdout.read().decode())
    
    ssh.close()
    print('VPS updated successfully (Nginx + Backend limits increased)')
except Exception as e:
    print(f'Error: {e}')
