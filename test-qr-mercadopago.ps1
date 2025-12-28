# Script: Probar Generación de QR con Mercado Pago In-Store
# Este script prueba que la generación de QR funcione correctamente

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "5fc90125-23b9-4200-bd86-c6edba203f16",
    
    [Parameter(Mandatory=$false)]
    [string]$Email = "test3@toludev.com",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "impresorA125"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Probar Generacion QR Mercado Pago In-Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tenant ID: $TenantId" -ForegroundColor Gray
Write-Host ""

# Autenticación automática
Write-Host "[0/3] Autenticando..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    $token = $loginResponse.session.access_token
    Write-Host "Login exitoso: $($loginResponse.user.email)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR en login: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifica las credenciales o crea un usuario en Supabase" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Paso 1: Crear una venta de prueba
Write-Host "[1/3] Creando venta de prueba..." -ForegroundColor Yellow

try {
    # Primero obtener un producto
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1&tenantId=$TenantId" -Method GET -Headers $headers -ErrorAction Stop
    
    if (-not $productsResponse.data -or $productsResponse.data.Count -eq 0) {
        Write-Host "ERROR: No hay productos disponibles. Crea un producto primero." -ForegroundColor Red
        exit 1
    }
    
    $product = $productsResponse.data[0]
    Write-Host "  Producto encontrado: $($product.name) (ID: $($product.id))" -ForegroundColor Gray
    
    # Crear venta
    $saleBody = @{
        items = @(
            @{
                productId = $product.id
                quantity = 1
                unitPrice = "1000.00"
            }
        )
    } | ConvertTo-Json
    
    $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales?tenantId=$TenantId" -Method POST -Headers $headers -Body $saleBody -ErrorAction Stop
    $saleId = $saleResponse.id
    
    Write-Host "  Venta creada: $saleId" -ForegroundColor Green
    
    # Confirmar venta
    Write-Host "[2/3] Confirmando venta..." -ForegroundColor Yellow
    $confirmResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm?tenantId=$TenantId" -Method POST -Headers $headers -ErrorAction Stop
    Write-Host "  Venta confirmada" -ForegroundColor Green
    
    # Crear pago QR
    Write-Host "[3/3] Creando pago QR..." -ForegroundColor Yellow
    $qrBody = @{
        qrType = "dynamic"
    } | ConvertTo-Json
    
    $qrResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments/qr?tenantId=$TenantId" -Method POST -Headers $headers -Body $qrBody -ErrorAction Stop
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Resultado" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Payment ID: $($qrResponse.id)" -ForegroundColor White
    Write-Host "Status: $($qrResponse.status)" -ForegroundColor White
    Write-Host "Amount: $($qrResponse.amount)" -ForegroundColor White
    Write-Host ""
    
    if ($qrResponse.gateway_metadata) {
        $metadata = $qrResponse.gateway_metadata
        Write-Host "Gateway Metadata:" -ForegroundColor Yellow
        Write-Host "  Provider: $($metadata.provider)" -ForegroundColor $(if ($metadata.provider -eq "mercadopago_instore") { "Green" } else { "Yellow" })
        Write-Host "  QR Code: $($metadata.qr_code.Substring(0, [Math]::Min(50, $metadata.qr_code.Length)))..." -ForegroundColor Gray
        Write-Host "  QR Payload length: $($metadata.qr_payload.Length) caracteres" -ForegroundColor Gray
        
        if ($metadata.expires_at) {
            Write-Host "  Expires at: $($metadata.expires_at)" -ForegroundColor Gray
        }
        
        Write-Host ""
        
        if ($metadata.provider -eq "mercadopago_instore") {
            Write-Host "SUCCESS: QR generado con Mercado Pago In-Store" -ForegroundColor Green
            Write-Host "  El QR es escaneable por la app de Mercado Pago" -ForegroundColor Green
        } elseif ($metadata.provider -eq "generic_qr") {
            Write-Host "ADVERTENCIA: Se uso QR generico (fallback)" -ForegroundColor Yellow
            Write-Host "  El QR NO es escaneable por Mercado Pago" -ForegroundColor Yellow
            Write-Host "  Verifica la configuracion del gateway" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERROR: No se genero gateway_metadata" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Para probar el QR:" -ForegroundColor Cyan
    Write-Host "1. Copia el qr_code (base64) de gateway_metadata" -ForegroundColor Gray
    Write-Host "2. Convierte a imagen o renderiza en frontend" -ForegroundColor Gray
    Write-Host "3. Escanea con la app de Mercado Pago" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "  Response: $responseBody" -ForegroundColor Gray
        } catch {
            Write-Host "  No se pudo leer respuesta del error" -ForegroundColor Gray
        }
    }
    exit 1
}

