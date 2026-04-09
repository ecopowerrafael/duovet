import paramiko
import os
import bcrypt

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def reset_admin_password():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        # New password to set
        new_password = "admin_password_123"
        # Generate hash locally (using bcrypt 8 rounds as in auth.js)
        # Note: auth.js uses bcryptjs but the hash format is the same.
        # We'll do it on the VPS directly to avoid compatibility issues.
        
        print(f"--- Resetting admin password to: {new_password} ---")
        
        # We'll use node on the VPS to generate the hash using the project's own dependencies
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
        error = stderr.read().decode()
        
        if error:
            print(f"Error generating hash: {error}")
            return

        hash_line = [line for line in output.splitlines() if line.startswith("HASH:")][0]
        password_hash = hash_line.replace("HASH:", "").strip()
        
        print(f"Generated hash: {password_hash}")
        
        # Update in database
        db_command = f"sudo -u postgres psql -d duovet -c \"UPDATE users SET password = '{password_hash}', status = 'active' WHERE email = 'admin@duovet.app';\""
        stdin, stdout, stderr = ssh.exec_command(db_command)
        print(stdout.read().decode())
        print(stderr.read().decode())

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_admin_password()
