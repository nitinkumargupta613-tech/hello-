<#
.SYNOPSIS
  Portable PostgreSQL 16 + PostGIS 3.6 for Windows, used when Docker is not
  available. Creates a self contained install under .local\ and exposes it on
  127.0.0.1:5432 with the same schema, PostGIS extension and GiST indexes as
  the docker-compose service.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\local-db.ps1 setup
  powershell -ExecutionPolicy Bypass -File scripts\local-db.ps1 start
#>
param(
  [ValidateSet("setup", "start", "stop", "status")]
  [string]$Action = "status",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Local = Join-Path $Root ".local"
$PgData = Join-Path $Local "pgdata"
$PgZip = Join-Path $Local "pg16-binaries.zip"
$PostgisZip = Join-Path $Local "postgis-pg16.zip"
$PgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.15-1-windows-x64-binaries.zip"
$PostgisUrl = "https://download.osgeo.org/postgis/windows/pg16/postgis-bundle-pg16-3.6.2x64.zip"
$Curl = Join-Path $env:SystemRoot "System32\curl.exe"

function Resolve-PgRoot {
  <#
    The PostgreSQL binaries can live in two places: the canonical .local\pgsql
    or the staging folder .local\pgtmp\pgsql when setup was interrupted.
    Resolve whichever actually contains pg_ctl.exe.
  #>
  $candidates = @(
    (Join-Path $Local "pgsql"),
    (Join-Path $Local "pgtmp\pgsql")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "bin\pg_ctl.exe")) { return $candidate }
  }
  return $null
}

$PgRoot = Resolve-PgRoot

function Setup {
  New-Item -ItemType Directory -Force -Path $Local | Out-Null
  if (-not (Test-Path $PgZip)) { & $Curl -sSkL -o $PgZip $PgUrl }
  if (-not (Test-Path $PostgisZip)) { & $Curl -sSkL -o $PostgisZip $PostgisUrl }

  Write-Host "Extracting PostgreSQL ..."
  if (Test-Path $PgRoot) { Remove-Item -Recurse -Force $PgRoot }
  Expand-Archive -LiteralPath $PgZip -DestinationPath (Join-Path $Local "pgtmp") -Force
  Move-Item (Join-Path $Local "pgtmp\pgsql") $PgRoot

  Write-Host "Extracting PostGIS bundle ..."
  $Bundle = Join-Path $Local "pgtmp\postgis-bundle-pg16-3.6.2x64"
  if (Test-Path $Bundle) { Remove-Item -Recurse -Force $Bundle }
  Expand-Archive -LiteralPath $PostgisZip -DestinationPath (Join-Path $Local "pgtmp") -Force

  Write-Host "Installing PostGIS into the PostgreSQL tree ..."
  Copy-Item (Join-Path $Bundle "lib\*") (Join-Path $PgRoot "lib") -Recurse -Force
  Copy-Item (Join-Path $Bundle "share\extension\*") (Join-Path $PgRoot "share\extension") -Recurse -Force
  Copy-Item (Join-Path $Bundle "share\contrib\*") (Join-Path $PgRoot "share\contrib") -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Bundle "bin\*") (Join-Path $PgRoot "bin") -Recurse -Force
  if (Test-Path (Join-Path $Bundle "gdal-data")) {
    Copy-Item -Recurse (Join-Path $Bundle "gdal-data") (Join-Path $PgRoot "share\gdal-data") -Force
  }

  Write-Host "Initialising the data directory ..."
  if (Test-Path $PgData) { Remove-Item -Recurse -Force $PgData }
  & (Join-Path $PgRoot "bin\initdb.exe") -D $PgData -U postgres -A trust -E UTF8 --locale=C | Out-Null
  Write-Host "Setup complete. Run: scripts\local-db.ps1 start"
}

function StartDb {
  if (-not (Test-Path $PgData)) { throw "No data directory. Run 'setup' first." }
  if (-not $PgRoot) { throw "PostgreSQL binaries not found. Run 'setup' first." }
  $pgCtl = Join-Path $PgRoot "bin\pg_ctl.exe"

  # Already running: nothing to do.
  & $pgCtl -D $PgData status >$null 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL is already running on 127.0.0.1:$Port"
    return
  }

  # Not running, but a pid file is left over from a crash or a hard stop.
  # pg_ctl would then wait for a server that is never coming and take a
  # minute to give up, so the stale file goes first.
  $pidFile = Join-Path $PgData "postmaster.pid"
  if (Test-Path $pidFile) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Host "Removed a stale postmaster.pid ..."
  }

  & $pgCtl -D $PgData -l (Join-Path $PgData "server.log") `
    -o "-p $Port -c listen_addresses=127.0.0.1" -w start

  # psql writes to stderr on "already exists", and with ErrorActionPreference
  # Stop that would abort the script, so relax it around the native calls.
  $strict = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $psql = Join-Path $PgRoot "bin\psql.exe"
  $exists = & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres `
    -tAc "SELECT 1 FROM pg_database WHERE datname='civicsense'" 2>$null
  if (-not $exists) {
    & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres `
      -tAc "CREATE DATABASE civicsense;" 2>$null | Out-Null
  }
  $ErrorActionPreference = $strict
  Write-Host "PostgreSQL + PostGIS listening on 127.0.0.1:$Port (db: civicsense, user: postgres)"
}

function StopDb {
  if (-not $PgRoot) { Write-Host "PostgreSQL binaries not found."; return }
  & (Join-Path $PgRoot "bin\pg_ctl.exe") -D $PgData -m fast -w stop
}

function Status {
  if (-not $PgRoot) {
    Write-Host "Not set up (no PostgreSQL binaries found)."
    exit 1
  }
  $psql = Join-Path $PgRoot "bin\psql.exe"
  $version = & $psql -h 127.0.0.1 -p $Port -U postgres -d civicsense -tAc "SELECT postgis_version();" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Database is not reachable on 127.0.0.1:$Port"
    exit 1
  }
  Write-Host $version
  exit 0
}

switch ($Action) {
  "setup" { Setup }
  "start" { StartDb }
  "stop" { StopDb }
  "status" { Status }
}
