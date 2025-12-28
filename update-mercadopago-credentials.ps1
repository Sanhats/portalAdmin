# Script: Actualizar Credenciales de Mercado Pago
# Actualiza el access token en .env.local y en la base de datos

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "APP_USR-6056863249479510-122803-be1893d7a5c544305a180bbe51abc4b1-1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$UserId = "1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "5fc90125-23b9-4200-bd86-c6edba203f16",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Actualizar Credenciales Mercado Pago" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "User ID: $UserId" -ForegroundColor Gray
Write-Host "Tenant ID: $TenantId" -ForegroundColor Gray
Write-Host ""

# Paso 1: Actualizar .env.local
Write-Host "[1/2] Actualizando .env.local..." -ForegroundColor Yellow

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "  Creando .env.local..." -ForegroundColor Gray
    New-Item -ItemType File -Path $envFile | Out-Null
}

$envContent = Get-Content $envFile -Raw
$newLine = "MERCADOPAGO_ACCESS_TOKEN=`"$AccessToken`""

if ($envContent -match 'MERCADOPAGO_ACCESS_TOKEN\s*=') {
    $envContent = $envContent -replace 'MERCADOPAGO_ACCESS_TOKEN\s*=.*', $newLine
    Write-Host "  Access token actualizado en .env.local" -ForegroundColor Green
} else {
    $envContent += "`n$newLine"
    Write-Host "  Access token agregado a .env.local" -ForegroundColor Green
}

Set-Content -Path $envFile -Value $envContent -NoNewline
Write-Host ""

# Paso 2: Actualizar en base de datos via API
Write-Host "[2/2] Actualizando credenciales en base de datos..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Necesitas autenticarte para actualizar el gateway" -ForegroundColor Yellow
Write-Host ""

$email = Read-Host "Email"
$password = Read-Host "Password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    # Login
    $loginBody = @{
        email = $email
        password = $plainPassword
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    $token = $loginResponse.session.access_token
    Write-Host "  Login exitoso" -ForegroundColor Green
    
    # Obtener gateway existente
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    Write-Host "  Obteniendo gateway existente..." -ForegroundColor Gray
    $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($gatewayResponse.data -and $gatewayResponse.data.Count -gt 0) {
        $gatewayId = $gatewayResponse.data[0].id
        Write-Host "  Gateway encontrado: $gatewayId" -ForegroundColor Green
        
        # Obtener config actual
        $currentConfig = $gatewayResponse.data[0].config
        if (-not $currentConfig) {
            $currentConfig = @{}
        }
        
        # Actualizar config con user_id si no está o es diferente
        if (-not $currentConfig.mercadopago_user_id -or $currentConfig.mercadopago_user_id -ne $UserId) {
            $currentConfig.mercadopago_user_id = $UserId
            Write-Host "  User ID actualizado en config" -ForegroundColor Green
        }
        
        # Mantener external_pos_id si existe
        if (-not $currentConfig.mercadopago_external_pos_id) {
            $currentConfig.mercadopago_external_pos_id = "123439423"
            Write-Host "  External POS ID configurado: 123439423" -ForegroundColor Green
        }
        
        # Actualizar gateway
        $updateBody = @{
            credentials = @{
                access_token = $AccessToken
            }
            config = $currentConfig
            enabled = $true
        } | ConvertTo-Json -Depth 10
        
        Write-Host "  Actualizando gateway..." -ForegroundColor Gray
        $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
            -Method PUT `
            -Headers $headers `
            -Body $updateBody `
            -ErrorAction Stop
        
        Write-Host "  Gateway actualizado exitosamente" -ForegroundColor Green
        
    } else {
        Write-Host "  No se encontró gateway, creando uno nuevo..." -ForegroundColor Yellow
        
        $createBody = @{
            provider = "mercadopago"
            credentials = @{
                access_token = $AccessToken
            }
            config = @{
                mercadopago_user_id = $UserId
                mercadopago_external_pos_id = "123439423"
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
            enabled = $true
        } | ConvertTo-Json -Depth 10
        
        $createResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?tenantId=$TenantId" `
            -Method POST `
            -Headers $headers `
            -Body $createBody `
            -ErrorAction Stop
        
        Write-Host "  Gateway creado exitosamente" -ForegroundColor Green
    }
    
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Puedes actualizar manualmente con este SQL:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
    Write-Host "SET credentials = jsonb_set(" -ForegroundColor DarkGray
    Write-Host "  COALESCE(credentials, '{}'::jsonb)," -ForegroundColor DarkGray
    Write-Host "  '{access_token}'," -ForegroundColor DarkGray
    Write-Host "  '$AccessToken'" -ForegroundColor DarkGray
    Write-Host ")," -ForegroundColor DarkGray
    Write-Host "config = jsonb_set(" -ForegroundColor DarkGray
    Write-Host "  jsonb_set(" -ForegroundColor DarkGray
    Write-Host "    COALESCE(config, '{}'::jsonb)," -ForegroundColor DarkGray
    Write-Host "    '{mercadopago_user_id}'," -ForegroundColor DarkGray
    Write-Host "    '$UserId'" -ForegroundColor DarkGray
    Write-Host "  )," -ForegroundColor DarkGray
    Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
    Write-Host "  '123439423'" -ForegroundColor DarkGray
    Write-Host ")" -ForegroundColor DarkGray
    Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
    Write-Host "  AND tenant_id = '$TenantId';" -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Credenciales Actualizadas" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciales configuradas:" -ForegroundColor White
Write-Host "  Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  User ID: $UserId" -ForegroundColor Gray
Write-Host "  External POS ID: 123439423" -ForegroundColor Gray
Write-Host ""
Write-Host "Prueba de nuevo:" -ForegroundColor Cyan
Write-Host "  .\test-qr-mercadopago.ps1" -ForegroundColor Yellow
Write-Host ""


