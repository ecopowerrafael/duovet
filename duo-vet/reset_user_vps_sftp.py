import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def reset_user_password_sftp():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        email = "giacobboigor@gmail.com"
        new_password = "password123"
        
        print(f"--- Resetting password for {email} to: {new_password} ---")
        
        # 1. Generate hash on VPS using Node.js
        node_command = """
        node -e "
        const bcrypt = require('bcryptjs');
        bcrypt.hash('""" + new_password + """', 8).then(hash => {
          process.stdout.write('HASH:' + hash);
        });
        "
        """
        
        stdin, stdout, stderr = ssh.exec_command(f"cd /var/www/duovet/backend && {node_command}")
        output = stdout.read().decode()
        
        if "HASH:" not in output:
            print("Failed to generate hash")
            print("Output:", output)
            return
            
        password_hash = output.split("HASH:")[1].strip()
        print(f"Generated hash: {password_hash}")
        
        # 2. Use SFTP to write the SQL file to avoid shell expansion issues
        sftp = ssh.open_sftp()
        sql_content = f"UPDATE users SET password = '{password_hash}', status = 'active' WHERE email = '{email}';"
        
        with sftp.file("/tmp/update_user.sql", "w") as f:
            f.write(sql_content)
        sftp.close()
        
        # 3. Run psql using the file
        db_command = "sudo -u postgres psql -d duovet -f /tmp/update_user.sql"
        stdin, stdout, stderr = ssh.exec_command(db_command)
        print("Psql output:", stdout.read().decode())
        
        # 4. Clean up
        ssh.exec_command("rm /tmp/update_user.sql")
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_user_password_sftp()
