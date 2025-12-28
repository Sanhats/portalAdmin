# Script: Configurar Mercado Pago In-Store con User ID conocido
# Usa el User ID proporcionado directamente

param(
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$MercadoPagoUserId = "1231202386",
    
    [Parameter(Mandatory=$false)]
    [string]$MercadoPagoExternalPosId = "POS_Toludev",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configurar Mercado Pago In-Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "User ID: $MercadoPagoUserId" -ForegroundColor Green
Write-Host "External POS ID: $MercadoPagoExternalPosId" -ForegroundColor Green
Write-Host ""

if ([string]::IsNullOrEmpty($TenantId)) {
    $TenantId = Read-Host "Ingresa el Tenant ID (UUID del store/comercio)"
    if ([string]::IsNullOrEmpty($TenantId)) {
        Write-Host "ERROR: Tenant ID es requerido" -ForegroundColor Red
        exit 1
    }
}

$apiHeaders = @{
    "Content-Type" = "application/json"
}

# Verificar si existe gateway
Write-Host "Verificando gateway existente..." -ForegroundColor Yellow
try {
    $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" -Method GET -Headers $apiHeaders -ErrorAction SilentlyContinue
    
    if ($gatewayResponse.data -and $gatewayResponse.data.Count -gt 0) {
        $gatewayId = $gatewayResponse.data[0].id
        Write-Host "Gateway existente encontrado: $gatewayId" -ForegroundColor Green
        
        # Actualizar gateway existente
        $updateBody = @{
            config = @{
                mercadopago_user_id = $MercadoPagoUserId
                mercadopago_external_pos_id = $MercadoPagoExternalPosId
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
            enabled = $true
        } | ConvertTo-Json -Depth 10
        
        Write-Host "Actualizando gateway..." -ForegroundColor Yellow
        $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" -Method PUT -Headers $apiHeaders -Body $updateBody -ErrorAction Stop
        Write-Host "Gateway actualizado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "No se encontró gateway, necesitas crearlo primero" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Ejecuta este SQL en Supabase:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
        Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
        Write-Host "  jsonb_set(" -ForegroundColor DarkGray
        Write-Host "    COALESCE(config, '{}'::jsonb)," -ForegroundColor DarkGray
        Write-Host "    '{mercadopago_user_id}'," -ForegroundColor DarkGray
        Write-Host "    '$MercadoPagoUserId'" -ForegroundColor DarkGray
        Write-Host "  )," -ForegroundColor DarkGray
        Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
        Write-Host "  '$MercadoPagoExternalPosId'" -ForegroundColor DarkGray
        Write-Host "), enabled = true" -ForegroundColor DarkGray
        Write-Host "WHERE provider = 'mercadopago' AND tenant_id = '$TenantId';" -ForegroundColor DarkGray
        Write-Host ""
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Configura manualmente con este SQL:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
    Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
    Write-Host "  jsonb_set(" -ForegroundColor DarkGray
    Write-Host "    COALESCE(config, '{}'::jsonb)," -ForegroundColor DarkGray
    Write-Host "    '{mercadopago_user_id}'," -ForegroundColor DarkGray
    Write-Host "    '$MercadoPagoUserId'" -ForegroundColor DarkGray
    Write-Host "  )," -ForegroundColor DarkGray
    Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
    Write-Host "  '$MercadoPagoExternalPosId'" -ForegroundColor DarkGray
    Write-Host "), enabled = true" -ForegroundColor DarkGray
    Write-Host "WHERE provider = 'mercadopago' AND tenant_id = '$TenantId';" -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuracion completada" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciales configuradas:" -ForegroundColor White
Write-Host "  User ID: $MercadoPagoUserId" -ForegroundColor Gray
Write-Host "  External POS ID: $MercadoPagoExternalPosId" -ForegroundColor Gray
Write-Host ""
Write-Host "Nota: El POS debe crearse manualmente en Mercado Pago Dashboard" -ForegroundColor Yellow
Write-Host "      o usando la API con permisos adecuados" -ForegroundColor Yellow
Write-Host ""

