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
    
    # New file for reproductive/andrological data
    local_new_route = r'c:\Users\Code\OneDrive\Documentos\duo-vet\duo-vet\backend\reproductive_andrological.js'
    remote_new_route = '/var/www/duovet/backend/reproductive_andrological.js'
    print(f"Uploading {local_new_route}...")
    sftp.put(local_new_route, remote_new_route)
    
    # Updated index.js
    local_index = r'c:\Users\Code\OneDrive\Documentos\duo-vet\duo-vet\backend\index.js'
    remote_index = '/var/www/duovet/backend/index.js'
    print(f"Uploading {local_index}...")
    sftp.put(local_index, remote_index)
    
    sftp.close()
    
    # 2. Restart PM2 to apply changes
    print("Restarting PM2...")
    stdin, stdout, stderr = ssh.exec_command('cd /var/www/duovet/backend && pm2 restart ecosystem.config.js')
    print(stdout.read().decode())
    
    ssh.close()
    print('VPS updated successfully (New routes added)')
except Exception as e:
    print(f'Error: {e}')
