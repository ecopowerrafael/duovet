import paramiko
import sys

VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def check_logs():
    print(f"Connecting to {VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(
            VPS_IP, 
            username=VPS_USER, 
            password=VPS_PASSWORD, 
            timeout=30, 
            look_for_keys=False,
            allow_agent=False
        )
        print("Connected successfully.")

        # Read db.js on VPS
        stdin, stdout, stderr = ssh.exec_command("cat /var/www/duovet/backend/db.js")
        print("\n--- DB.JS ON VPS ---")
        print(stdout.read().decode('utf-8'))

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_logs()
