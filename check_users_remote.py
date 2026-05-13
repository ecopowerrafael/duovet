import paramiko
import os

VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def deploy_and_check():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        sftp = ssh.open_sftp()
        
        print("Uploading check_users.js...")
        sftp.put("backend/check_users.js", "/var/www/duovet/backend/check_users.js")
        sftp.close()

        print("--- Executing check_users.js on VPS ---")
        stdin, stdout, stderr = ssh.exec_command("cd /var/www/duovet/backend && node check_users.js")
        print(stdout.read().decode())
        print(stderr.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    deploy_and_check()
