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
    
    # 1. Update upload.js on VPS
    sftp = ssh.open_sftp()
    
    local_path = r'c:\Users\Code\OneDrive\Documentos\duo-vet\duo-vet\backend\upload.js'
    remote_path = '/var/www/duovet/backend/upload.js'
    
    print(f"Uploading {local_path} to {remote_path}...")
    sftp.put(local_path, remote_path)
    sftp.close()
    
    # 2. Restart PM2 to apply changes
    print("Restarting PM2...")
    stdin, stdout, stderr = ssh.exec_command('cd /var/www/duovet/backend && pm2 restart ecosystem.config.js')
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Stderr: {err}")
    
    ssh.close()
    print('VPS updated successfully')
except Exception as e:
    print(f'Error: {e}')
