$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir
# Configuration
$VPS_USER = "root"
$VPS_IP = "187.77.43.105"
$VPS_PASSWORD = "2705#Data2705"
$VPS_HOSTKEY = "ssh-ed25519 255 SHA256:oMzogR4s06C5sfjd0OmQQFqS6sg5s6zsLcNSjvkg2TI"
$REMOTE_DIR = "/var/www/duovet"
$REMOTE_TMP = "/tmp"

# Build frontend
Write-Host "Building frontend..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}

# Compress backend (excluding node_modules)
Write-Host "Compressing backend..."
tar --exclude=node_modules --exclude=.env -czf backend.tar.gz backend

# Compress frontend
Write-Host "Compressing frontend..."
tar -czf dist.tar.gz dist

# Upload files using pscp
Write-Host "Uploading files..."
$PSCP = Join-Path $env:TEMP "pscp.exe"
$PLINK = Join-Path $env:TEMP "plink.exe"
if (!(Test-Path $PSCP) -or !(Test-Path $PLINK)) {
    Write-Error "pscp/plink not found in TEMP. Download them first."
    exit 1
}
$PW_FILE = Join-Path $env:TEMP "duovet_pw.txt"
Set-Content -Path $PW_FILE -Value $VPS_PASSWORD -NoNewline
& $PSCP -batch -pwfile $PW_FILE -hostkey $VPS_HOSTKEY backend.tar.gz dist.tar.gz ${VPS_USER}@${VPS_IP}:${REMOTE_TMP}/
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

    # Extract backend
    rm -rf $REMOTE_DIR/backend
    tar -xzf $REMOTE_TMP/backend.tar.gz -C $REMOTE_DIR
    
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
& $PLINK -batch -pwfile $PW_FILE -hostkey $VPS_HOSTKEY ${VPS_USER}@${VPS_IP} $REMOTE_SCRIPT
if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote deploy failed"
    exit 1
}

# Cleanup local files
Remove-Item backend.tar.gz
Remove-Item dist.tar.gz
Remove-Item $PW_FILE -ErrorAction SilentlyContinue

Write-Host "Deployment complete!"
