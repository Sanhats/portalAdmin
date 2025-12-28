# Script: Verificar que el Access Token corresponde al User ID
# Verifica que el user_id configurado coincida con el del access token

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificar User ID vs Access Token" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener access token desde .env.local si no se proporciona
if ([string]::IsNullOrEmpty($AccessToken)) {
    $envFile = ".env.local"
    if (Test-Path $envFile) {
        Write-Host "Leyendo Access Token desde .env.local..." -ForegroundColor Gray
        $envLines = Get-Content $envFile
        foreach ($line in $envLines) {
            if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
                $AccessToken = $matches[1].Trim()
                if ($AccessToken.StartsWith('"') -and $AccessToken.EndsWith('"')) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                if ($AccessToken.StartsWith("'") -and $AccessToken.EndsWith("'")) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                break
            }
        }
    }
}

if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "ERROR: Access Token no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Obtener información del usuario desde el access token
Write-Host "[1/2] Obteniendo informacion del usuario desde el access token..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $userResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/users/me" -Method GET -Headers $headers -ErrorAction Stop
    
    $userIdFromToken = $userResponse.id.ToString()
    $nickname = $userResponse.nickname
    $email = $userResponse.email
    
    Write-Host "Usuario del Access Token:" -ForegroundColor Green
    Write-Host "  User ID: $userIdFromToken" -ForegroundColor White
    Write-Host "  Nombre: $nickname" -ForegroundColor White
    Write-Host "  Email: $email" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR al obtener informacion del usuario: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Verificar user_id configurado en BD
Write-Host "[2/2] Verificando user_id configurado en BD..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Ejecuta este SQL en Supabase para verificar:" -ForegroundColor Cyan
Write-Host ""
Write-Host "SELECT" -ForegroundColor DarkGray
Write-Host "  config->>'mercadopago_user_id' as configured_user_id," -ForegroundColor DarkGray
Write-Host "  config->>'mercadopago_external_pos_id' as external_pos_id" -ForegroundColor DarkGray
Write-Host "FROM payment_gateways" -ForegroundColor DarkGray
Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
Write-Host "  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';" -ForegroundColor DarkGray
Write-Host ""

# Comparar
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Comparacion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "User ID del Access Token: $userIdFromToken" -ForegroundColor White
Write-Host "User ID configurado en BD: 1231202386" -ForegroundColor White
Write-Host ""

if ($userIdFromToken -eq "1231202386") {
    Write-Host "Los User IDs coinciden" -ForegroundColor Green
    Write-Host ""
    Write-Host "El problema puede ser:" -ForegroundColor Yellow
    Write-Host "1. El access token no tiene permisos para In-Store API" -ForegroundColor Gray
    Write-Host "2. El POS no existe o el external_id es incorrecto" -ForegroundColor Gray
    Write-Host "3. El access token es de sandbox pero estas usando produccion" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Verifica:" -ForegroundColor Cyan
    Write-Host "- Que el access token tenga permisos de 'In-Store' en Mercado Pago" -ForegroundColor Gray
    Write-Host "- Que el POS con external_id 'POS_Toludev' exista" -ForegroundColor Gray
    Write-Host "- Que el access token sea de produccion (APP_USR-...) si el POS es de produccion" -ForegroundColor Gray
} else {
    Write-Host "ADVERTENCIA: Los User IDs NO coinciden" -ForegroundColor Red
    Write-Host ""
    Write-Host "El access token pertenece al usuario: $userIdFromToken" -ForegroundColor Yellow
    Write-Host "Pero en BD esta configurado: 1231202386" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solucion:" -ForegroundColor Cyan
    Write-Host "Actualiza el user_id en BD con el valor correcto:" -ForegroundColor White
    Write-Host ""
    Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
    Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
    Write-Host "  config," -ForegroundColor DarkGray
    Write-Host "  '{mercadopago_user_id}'," -ForegroundColor DarkGray
    Write-Host "  '$userIdFromToken'" -ForegroundColor DarkGray
    Write-Host ")" -ForegroundColor DarkGray
    Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
    Write-Host "  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';" -ForegroundColor DarkGray
    Write-Host ""
}

