import paramiko

VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def check_nginx_logs():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- Nginx Error Logs (Last 20 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("tail -n 20 /var/log/nginx/error.log")
        print(stdout.read().decode())
        
        print("--- Nginx Access Logs (Last 20 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("tail -n 20 /var/log/nginx/access.log")
        print(stdout.read().decode())

        print("--- PM2 Error Logs (Last 20 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 logs duovet-api --err --lines 20 --no-colors")
        # pm2 logs with --lines and --no-daemon should exit
        stdin, stdout, stderr = ssh.exec_command("tail -n 20 ~/.pm2/logs/duovet-api-error.log")
        print(stdout.read().decode())

        print("--- PM2 Out Logs (Last 20 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("tail -n 20 ~/.pm2/logs/duovet-api-out.log")
        print(stdout.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_nginx_logs()
