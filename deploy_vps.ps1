$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir
# Configuration
$VPS_USER = "root"
$VPS_IP = "187.77.43.105"
$VPS_HOSTKEY = "ssh-ed25519 255 SHA256:oMzogR4s06C5sfjd0OmQQFqS6sg5s6zsLcNSjvkg2TI"
$REMOTE_DIR = "/var/www/duovet"
$REMOTE_TMP = "/tmp"

function Require-Command($Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Error "$Name not found. Install it and try again."
        exit 1
    }
}

Require-Command "tar"
Require-Command "npm"
Require-Command "node"

$PSCP = Join-Path $env:TEMP "pscp.exe"
$PLINK = Join-Path $env:TEMP "plink.exe"
if (!(Test-Path $PSCP) -or !(Test-Path $PLINK)) {
    Write-Error "pscp/plink not found in TEMP. Download them first."
    exit 1
}

$PW_FILE = $null
$AUTH_ARGS = @()
$OPENSSH_ARGS = @()
$USE_OPENSSH = $false
try {
    # Build frontend
    Write-Host "Installing frontend dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend install failed"
        exit 1
    }
    
    Write-Host "Building frontend..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed"
        exit 1
    }

# Compress backend (excluding node_modules, mas incluindo .env)
Write-Host "Compressing backend..."
tar --exclude=node_modules -czf backend.tar.gz backend

# Compress frontend
Write-Host "Compressing frontend..."
tar -czf dist.tar.gz dist

# Upload files using pscp
Write-Host "Uploading files..."
$VPS_KEY_FILE = $env:DUOVET_VPS_KEY_FILE
if (-not $VPS_KEY_FILE) {
    $sshDir = Join-Path $HOME ".ssh"
    $candidateKeys = @(
        (Join-Path $sshDir "duovet.ppk"),
        (Join-Path $sshDir "duovet_deploy.ppk"),
        (Join-Path $sshDir "duovet_deploy_key.ppk"),
        (Join-Path $sshDir "id_ed25519.ppk"),
        (Join-Path $sshDir "id_rsa.ppk"),
        (Join-Path $sshDir "duovet"),
        (Join-Path $sshDir "duovet_deploy"),
        (Join-Path $sshDir "duovet_deploy_key"),
        (Join-Path $sshDir "id_ed25519"),
        (Join-Path $sshDir "id_rsa")
    )
    $VPS_KEY_FILE = $candidateKeys | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ($VPS_KEY_FILE) {
    if (!(Test-Path $VPS_KEY_FILE)) {
        Write-Error "SSH key file not found: $VPS_KEY_FILE"
        exit 1
    }
    if ($VPS_KEY_FILE.ToLower().EndsWith(".ppk")) {
        Write-Host "Using SSH key authentication (PuTTY PPK): $VPS_KEY_FILE"
        $AUTH_ARGS = @("-i", $VPS_KEY_FILE)
    }
    else {
        $sshCmd = Get-Command "ssh" -ErrorAction SilentlyContinue
        $scpCmd = Get-Command "scp" -ErrorAction SilentlyContinue
        if (-not $sshCmd -or -not $scpCmd) {
            Write-Error "OpenSSH ssh/scp not found. Install OpenSSH Client or provide a .ppk key in DUOVET_VPS_KEY_FILE."
            exit 1
        }

        Write-Host "Using SSH key authentication (OpenSSH): $VPS_KEY_FILE"
        $USE_OPENSSH = $true
        $OPENSSH_ARGS = @(
            "-i", $VPS_KEY_FILE,
            "-o", "BatchMode=yes",
            "-o", "StrictHostKeyChecking=accept-new"
        )
    }
}
else {
    $VPS_PASSWORD = $env:DUOVET_VPS_PASSWORD
    if (-not $VPS_PASSWORD) {
        $secure = Read-Host "VPS password" -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $VPS_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    $PW_FILE = Join-Path $env:TEMP "duovet_pw.txt"
    Set-Content -Path $PW_FILE -Value $VPS_PASSWORD -NoNewline
    $AUTH_ARGS = @("-pwfile", $PW_FILE)
}

if ($USE_OPENSSH) {
    & scp @OPENSSH_ARGS "backend.tar.gz" "dist.tar.gz" "${VPS_USER}@${VPS_IP}:${REMOTE_TMP}/"
}
else {
    & $PSCP -batch -hostkey $VPS_HOSTKEY @AUTH_ARGS backend.tar.gz dist.tar.gz ${VPS_USER}@${VPS_IP}:${REMOTE_TMP}/
}
if ($LASTEXITCODE -ne 0) {
    Write-Error "Upload failed"
    exit 1
}

# Execute remote commands using plink
Write-Host "Deploying on server..."
$REMOTE_SCRIPT = "

    # Create directory if not exists
    mkdir -p $REMOTE_DIR

    # Backup .env if exists
    if [ -f $REMOTE_DIR/backend/.env ]; then
        cp $REMOTE_DIR/backend/.env $REMOTE_TMP/.env.bak
    fi

    # Preservar uploads
    if [ -d $REMOTE_DIR/backend/uploads ]; then
        mv $REMOTE_DIR/backend/uploads $REMOTE_TMP/uploads_backup
    fi

    # Extract backend (remove apenas o backend, não uploads)
    rm -rf $REMOTE_DIR/backend
    tar -xzf $REMOTE_TMP/backend.tar.gz -C $REMOTE_DIR

    # Restaurar uploads
    if [ -d $REMOTE_TMP/uploads_backup ]; then
        mv $REMOTE_TMP/uploads_backup $REMOTE_DIR/backend/uploads
    fi

    # Restore .env
    if [ -f $REMOTE_TMP/.env.bak ]; then
        mv $REMOTE_TMP/.env.bak $REMOTE_DIR/backend/.env
    fi
    
    # Extract frontend
    rm -rf $REMOTE_DIR/dist
    tar -xzf $REMOTE_TMP/dist.tar.gz -C $REMOTE_DIR
    
    # Move frontend files to root
    cp -r $REMOTE_DIR/dist/* $REMOTE_DIR/
    rm -rf $REMOTE_DIR/dist
    
    # Install dependencies and restart
    cd $REMOTE_DIR/backend
    
    echo 'Files in backend:'
    ls -la
    
    npm install --production
    
    # Run schema migration
    echo 'Running schema migration...'
    node migrate_fix_schema.js
    
    # Ensure PM2 is started
    pm2 restart all || pm2 start index.js --name duovet-backend
"
if ($USE_OPENSSH) {
    $remoteScriptPath = Join-Path $env:TEMP "duovet_remote_deploy.sh"
    Set-Content -Path $remoteScriptPath -Value $REMOTE_SCRIPT -NoNewline
    & ssh @OPENSSH_ARGS "${VPS_USER}@${VPS_IP}" "bash -s" < $remoteScriptPath
    Remove-Item $remoteScriptPath -ErrorAction SilentlyContinue
}
else {
    & $PLINK -batch -hostkey $VPS_HOSTKEY @AUTH_ARGS ${VPS_USER}@${VPS_IP} $REMOTE_SCRIPT
}
if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote deploy failed"
    exit 1
}

Write-Host "Deployment complete!"
}
finally {
    if ($PW_FILE -and (Test-Path $PW_FILE)) { Remove-Item $PW_FILE -ErrorAction SilentlyContinue }
    if (Test-Path "backend.tar.gz") { Remove-Item "backend.tar.gz" -ErrorAction SilentlyContinue }
    if (Test-Path "dist.tar.gz") { Remove-Item "dist.tar.gz" -ErrorAction SilentlyContinue }
}
