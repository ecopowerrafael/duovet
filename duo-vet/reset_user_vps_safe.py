import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def reset_user_password_safe():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        email = "ecopower.rafael@gmail.com"
        new_password = "password123"
        
        print(f"--- Resetting password for {email} to: {new_password} ---")
        
        # Use single quotes for the hash to avoid shell expansion
        node_command = f"""
        node -e "
        const bcrypt = require('bcryptjs');
        bcrypt.hash('{new_password}', 8).then(hash => {{
          process.stdout.write('HASH:' + hash);
        }});
        "
        """
        
        stdin, stdout, stderr = ssh.exec_command(f"cd /var/www/duovet/backend && {node_command}")
        output = stdout.read().decode()
        
        if "HASH:" not in output:
            print("Failed to generate hash")
            return
            
        password_hash = output.split("HASH:")[1].strip()
        print(f"Generated hash: {password_hash}")
        
        # Now use a safer way to run psql. We'll write a temporary sql file.
        sql = f"UPDATE users SET password = '{password_hash}', status = 'active' WHERE email = '{email}';"
        
        # Use cat to write the sql to a file
        ssh.exec_command(f"echo \"{sql}\" > /tmp/update_user.sql")
        
        # Run psql with the file
        db_command = f"sudo -u postgres psql -d duovet -f /tmp/update_user.sql"
        stdin, stdout, stderr = ssh.exec_command(db_command)
        print(stdout.read().decode())
        
        ssh.exec_command("rm /tmp/update_user.sql")

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_user_password_safe()
