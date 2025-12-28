# Script: Verificar Configuración Mercado Pago In-Store
# Verifica que la configuración esté correcta

param(
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "5fc90125-23b9-4200-bd86-c6edba203f16",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificar Configuracion Mercado Pago In-Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tenant ID: $TenantId" -ForegroundColor Gray
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
}

# Verificar gateway configurado
Write-Host "[1/2] Verificando gateway..." -ForegroundColor Yellow
try {
    $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" -Method GET -Headers $headers -ErrorAction Stop
    
    if ($gatewayResponse.data -and $gatewayResponse.data.Count -gt 0) {
        $gateway = $gatewayResponse.data[0]
        $config = $gateway.config
        
        Write-Host "Gateway encontrado: $($gateway.id)" -ForegroundColor Green
        Write-Host "  Enabled: $($gateway.enabled)" -ForegroundColor Gray
        Write-Host ""
        
        if ($config) {
            Write-Host "Configuracion actual:" -ForegroundColor Yellow
            Write-Host "  User ID: $($config.mercadopago_user_id)" -ForegroundColor $(if ($config.mercadopago_user_id) { "Green" } else { "Red" })
            Write-Host "  External POS ID: $($config.mercadopago_external_pos_id)" -ForegroundColor $(if ($config.mercadopago_external_pos_id) { "Green" } else { "Red" })
            Write-Host ""
            
            if ($config.mercadopago_user_id -and $config.mercadopago_external_pos_id -and $gateway.enabled) {
                Write-Host "Configuracion completa y habilitada" -ForegroundColor Green
            } else {
                Write-Host "ADVERTENCIA: Configuracion incompleta" -ForegroundColor Yellow
                if (-not $config.mercadopago_user_id) {
                    Write-Host "  - Falta mercadopago_user_id" -ForegroundColor Red
                }
                if (-not $config.mercadopago_external_pos_id) {
                    Write-Host "  - Falta mercadopago_external_pos_id" -ForegroundColor Red
                }
                if (-not $gateway.enabled) {
                    Write-Host "  - Gateway deshabilitado" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "ADVERTENCIA: No hay configuracion" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERROR: No se encontro gateway de Mercado Pago" -ForegroundColor Red
        Write-Host "  Crea uno primero o verifica el tenant_id" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR al verificar gateway: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Asegurate de que el servidor este corriendo" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] Verificando variables de entorno..." -ForegroundColor Yellow

# Verificar access token en .env.local
$envFile = ".env.local"
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile
    $hasAccessToken = $false
    foreach ($line in $envLines) {
        if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
            $hasAccessToken = $true
            $tokenPreview = $matches[1].Trim()
            if ($tokenPreview.StartsWith('"') -and $tokenPreview.EndsWith('"')) {
                $tokenPreview = $tokenPreview.Substring(1, $tokenPreview.Length - 2)
            }
            Write-Host "  Access Token: $($tokenPreview.Substring(0, [Math]::Min(30, $tokenPreview.Length)))..." -ForegroundColor Green
            break
        }
    }
    if (-not $hasAccessToken) {
        Write-Host "  ADVERTENCIA: MERCADOPAGO_ACCESS_TOKEN no encontrado en .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ADVERTENCIA: .env.local no encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para probar la generacion de QR:" -ForegroundColor White
Write-Host "1. Crea una venta y confirmala" -ForegroundColor Gray
Write-Host "2. POST /api/sales/{sale_id}/payments/qr" -ForegroundColor Gray
Write-Host "3. Verifica que gateway_metadata.provider = 'mercadopago_instore'" -ForegroundColor Gray
Write-Host ""

