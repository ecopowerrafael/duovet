import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def reset_user_password():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        email = "ecopower.rafael@gmail.com"
        new_password = "password123"
        
        print(f"--- Resetting password for {email} to: {new_password} ---")
        
        node_command = f"""
        node -e "
        const bcrypt = require('bcryptjs');
        bcrypt.hash('{new_password}', 8).then(hash => {{
          console.log('HASH:' + hash);
        }});
        "
        """
        
        stdin, stdout, stderr = ssh.exec_command(f"cd /var/www/duovet/backend && {node_command}")
        output = stdout.read().decode()
        hash_line = [line for line in output.splitlines() if line.startswith("HASH:")][0]
        password_hash = hash_line.replace("HASH:", "").strip()
        
        db_command = f"sudo -u postgres psql -d duovet -c \"UPDATE users SET password = '{password_hash}', status = 'active' WHERE email = '{email}';\""
        stdin, stdout, stderr = ssh.exec_command(db_command)
        print(stdout.read().decode())
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_user_password()
