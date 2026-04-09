import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_db_connectivity_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- Checking PostgreSQL Status ---")
        stdin, stdout, stderr = ssh.exec_command("systemctl status postgresql")
        print(stdout.read().decode())
        
        print("--- Testing Database Query ---")
        # Try to list users
        stdin, stdout, stderr = ssh.exec_command('sudo -u postgres psql -d duovet -c "SELECT id, email FROM users;"')
        print(stdout.read().decode())
        print(stderr.read().decode())

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db_connectivity_vps()
