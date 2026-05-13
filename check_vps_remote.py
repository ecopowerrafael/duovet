import paramiko

VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def check_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        print("--- PM2 Status ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 status")
        print(stdout.read().decode())
        
        print("--- PM2 Logs (Last 50 lines) ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 logs duovet-api --lines 50 --no-colors")
        # Note: pm2 logs might not exit immediately if not using --no-daemon or similar, 
        # but with --lines and it should show and finish if it's a snapshot.
        # Actually pm2 logs is usually a stream. Let's use 'pm2 flush' then check logs or just tail the file.
        stdin, stdout, stderr = ssh.exec_command("tail -n 50 ~/.pm2/logs/duovet-api-out.log")
        print("OUT LOG:")
        print(stdout.read().decode())
        
        stdin, stdout, stderr = ssh.exec_command("tail -n 50 ~/.pm2/logs/duovet-api-error.log")
        print("ERROR LOG:")
        print(stdout.read().decode())

        print("--- Database Check ---")
        stdin, stdout, stderr = ssh.exec_command("cd /var/www/duovet/backend && node check_db.js")
        print(stdout.read().decode())
        print(stderr.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_vps()
