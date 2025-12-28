# Script de Configuración: Mercado Pago In-Store QR POS
# Este script ayuda a configurar Mercado Pago In-Store para generar QR escaneables

param(
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$MercadoPagoUserId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$MercadoPagoExternalPosId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuración Mercado Pago In-Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Solicitar valores si no se proporcionaron
if ([string]::IsNullOrEmpty($TenantId)) {
    $TenantId = Read-Host "Ingresa el Tenant ID (UUID)"
}

if ([string]::IsNullOrEmpty($MercadoPagoUserId)) {
    $MercadoPagoUserId = Read-Host "Ingresa el Mercado Pago User ID (Collector ID, numérico)"
}

if ([string]::IsNullOrEmpty($MercadoPagoExternalPosId)) {
    $MercadoPagoExternalPosId = Read-Host "Ingresa el External POS ID (ej: POS_TUCUMAN_01)"
}

# Verificar si hay un gateway existente
Write-Host "`n[1/3] Verificando gateway existente..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" -Method GET -Headers $headers -ErrorAction Stop
    
    if ($response.data -and $response.data.Count -gt 0) {
        $gateway = $response.data[0]
        Write-Host "✅ Gateway encontrado: $($gateway.id)" -ForegroundColor Green
        Write-Host "   Estado actual: $($gateway.enabled)" -ForegroundColor Gray
        Write-Host "   Config actual: $($gateway.config | ConvertTo-Json -Compress)" -ForegroundColor Gray
        
        $gatewayId = $gateway.id
        $updateGateway = $true
    } else {
        Write-Host "⚠️  No se encontró gateway de Mercado Pago" -ForegroundColor Yellow
        $updateGateway = $false
    }
} catch {
    Write-Host "❌ Error al verificar gateway: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Asegúrate de que el servidor esté corriendo y autenticado" -ForegroundColor Yellow
    exit 1
}

# Actualizar o crear gateway
Write-Host "`n[2/3] Configurando Mercado Pago In-Store..." -ForegroundColor Yellow

$configBody = @{
    config = @{
        mercadopago_user_id = $MercadoPagoUserId
        mercadopago_external_pos_id = $MercadoPagoExternalPosId
        notification_url = "$BaseUrl/api/webhooks/mercadopago"
        auto_return = $false
    }
    enabled = $true
} | ConvertTo-Json -Depth 10

if ($updateGateway) {
    # Actualizar gateway existente
    try {
        $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" -Method PUT -Headers $headers -Body $configBody -ErrorAction Stop
        Write-Host "✅ Gateway actualizado exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error al actualizar gateway: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Gray
        exit 1
    }
} else {
    # Crear nuevo gateway (requiere access_token)
    if ([string]::IsNullOrEmpty($AccessToken)) {
        $AccessToken = Read-Host "Ingresa el Access Token de Mercado Pago (APP_USR-...)"
    }
    
    $createBody = @{
        provider = "mercadopago"
        enabled = $true
        credentials = @{
            access_token = $AccessToken
        }
        config = @{
            mercadopago_user_id = $MercadoPagoUserId
            mercadopago_external_pos_id = $MercadoPagoExternalPosId
            notification_url = "$BaseUrl/api/webhooks/mercadopago"
            auto_return = $false
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $createResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?tenantId=$TenantId" -Method POST -Headers $headers -Body $createBody -ErrorAction Stop
        Write-Host "✅ Gateway creado exitosamente: $($createResponse.id)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error al crear gateway: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Gray
        exit 1
    }
}

# Verificar configuración
Write-Host "`n[3/3] Verificando configuración..." -ForegroundColor Yellow

try {
    $verifyResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" -Method GET -Headers $headers -ErrorAction Stop
    
    if ($verifyResponse.data -and $verifyResponse.data.Count -gt 0) {
        $gateway = $verifyResponse.data[0]
        $config = $gateway.config
        
        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "✅ Configuración completada" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Gateway ID: $($gateway.id)" -ForegroundColor White
        Write-Host "Provider: $($gateway.provider)" -ForegroundColor White
        Write-Host "Enabled: $($gateway.enabled)" -ForegroundColor White
        Write-Host "User ID: $($config.mercadopago_user_id)" -ForegroundColor White
        Write-Host "External POS ID: $($config.mercadopago_external_pos_id)" -ForegroundColor White
        Write-Host "========================================" -ForegroundColor Cyan
        
        if ($config.mercadopago_user_id -and $config.mercadopago_external_pos_id -and $gateway.enabled) {
            Write-Host "`n✅ Todo listo para generar QR escaneables con Mercado Pago!" -ForegroundColor Green
        } else {
            Write-Host "`n⚠️  Verifica que todos los campos estén configurados correctamente" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Error al verificar: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n💡 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Probar generación de QR: POST /api/sales/{sale_id}/payments/qr" -ForegroundColor Gray
Write-Host "   2. Verificar que provider = 'mercadopago_instore' en la respuesta" -ForegroundColor Gray
Write-Host "   3. Escanear QR con la app de Mercado Pago" -ForegroundColor Gray

