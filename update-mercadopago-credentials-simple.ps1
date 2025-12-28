# Script: Actualizar Credenciales de Mercado Pago (Versión Simple)
# Actualiza solo el access token en .env.local y muestra el SQL para BD

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "APP_USR-6056863249479510-122803-be1893d7a5c544305a180bbe51abc4b1-1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$UserId = "1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "5fc90125-23b9-4200-bd86-c6edba203f16"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Actualizar Credenciales Mercado Pago" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access Token: $($AccessToken.Substring(0, 30))..." -ForegroundColor Gray
Write-Host "User ID: $UserId" -ForegroundColor Gray
Write-Host ""

# Actualizar .env.local
Write-Host "[1/2] Actualizando .env.local..." -ForegroundColor Yellow

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "  Creando .env.local..." -ForegroundColor Gray
    New-Item -ItemType File -Path $envFile | Out-Null
}

$envLines = Get-Content $envFile
$updated = $false
$newLines = @()

foreach ($line in $envLines) {
    if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=') {
        $newLines += "MERCADOPAGO_ACCESS_TOKEN=`"$AccessToken`""
        $updated = $true
    } else {
        $newLines += $line
    }
}

if (-not $updated) {
    $newLines += "MERCADOPAGO_ACCESS_TOKEN=`"$AccessToken`""
}

Set-Content -Path $envFile -Value ($newLines -join "`n")
Write-Host "  Access token actualizado en .env.local" -ForegroundColor Green
Write-Host ""

# Mostrar SQL para actualizar BD
Write-Host "[2/2] SQL para actualizar base de datos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ejecuta este SQL en Supabase SQL Editor:" -ForegroundColor Cyan
Write-Host ""
Write-Host "UPDATE payment_gateways" -ForegroundColor White
Write-Host "SET credentials = jsonb_set(" -ForegroundColor White
Write-Host "  COALESCE(credentials, '{}'::jsonb)," -ForegroundColor White
Write-Host "  '{access_token}'," -ForegroundColor White
Write-Host "  '\"$AccessToken\"'" -ForegroundColor White
Write-Host ")," -ForegroundColor White
Write-Host "config = jsonb_set(" -ForegroundColor White
Write-Host "  jsonb_set(" -ForegroundColor White
Write-Host "    COALESCE(config, '{}'::jsonb)," -ForegroundColor White
Write-Host "    '{mercadopago_user_id}'," -ForegroundColor White
Write-Host "    '\"$UserId\"'" -ForegroundColor White
Write-Host "  )," -ForegroundColor White
Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor White
Write-Host "  '\"123439423\"'" -ForegroundColor White
Write-Host ")," -ForegroundColor White
Write-Host "enabled = true" -ForegroundColor White
Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor White
Write-Host "  AND tenant_id = '$TenantId';" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Credenciales Actualizadas" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Despues de ejecutar el SQL, prueba de nuevo:" -ForegroundColor Yellow
Write-Host "  .\test-qr-mercadopago.ps1" -ForegroundColor Cyan
Write-Host ""


