import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def create_env_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        env_content = """PGUSER=postgres
PGHOST=localhost
PGDATABASE=duovet
PGPASSWORD=postgres
PGPORT=5432
PORT=4000
JWT_SECRET=sua_chave_secreta
"""
        
        print("--- Creating .env on VPS ---")
        sftp = ssh.open_sftp()
        with sftp.file("/var/www/duovet/backend/.env", "w") as f:
            f.write(env_content)
        sftp.close()
        
        print("--- Restarting PM2 to apply changes ---")
        ssh.exec_command("pm2 restart duovet-api")
        
        ssh.close()
        print("Done.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_env_vps()
