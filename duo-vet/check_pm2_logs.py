import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_pm2_logs_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- PM2 Out Logs (Last 50 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 logs duovet-api --lines 50 --nostream")
        print(stdout.read().decode())
        
        print("--- PM2 Error Logs (Last 50 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 logs duovet-api --err --lines 50 --nostream")
        print(stdout.read().decode())

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_pm2_logs_vps()
