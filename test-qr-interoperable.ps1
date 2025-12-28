# Script: Probar Generación de QR Interoperable
# Este script prueba que la generación de QR interoperable funcione correctamente

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
Write-Host "Probar Generacion QR Interoperable" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tenant ID: $TenantId" -ForegroundColor Gray
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Autenticación automática
Write-Host "[0/4] Autenticando..." -ForegroundColor Yellow
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
    "x-tenant-id" = $TenantId
}

# Paso 1: Obtener un producto
Write-Host "[1/4] Obteniendo producto..." -ForegroundColor Yellow
try {
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if (-not $productsResponse.data -or $productsResponse.data.Count -eq 0) {
        Write-Host "ERROR: No hay productos disponibles" -ForegroundColor Red
        Write-Host "Crea al menos un producto antes de probar" -ForegroundColor Yellow
        exit 1
    }
    
    $product = $productsResponse.data[0]
    Write-Host "Producto encontrado: $($product.name_internal) (ID: $($product.id))" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR al obtener productos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Paso 2: Crear una venta confirmada
Write-Host "[2/4] Creando venta confirmada..." -ForegroundColor Yellow
try {
    $saleBody = @{
        items = @(
            @{
                productId = $product.id
                quantity = 1
                unitPrice = 2500
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $saleBody `
        -ErrorAction Stop
    
    $saleId = $saleResponse.id
    Write-Host "Venta creada: $saleId" -ForegroundColor Green
    Write-Host "Total: $($saleResponse.total_amount)" -ForegroundColor Gray
    
    # Confirmar la venta
    $confirmResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
        -Method POST `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "Venta confirmada exitosamente" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR al crear/confirmar venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Detalles: $errorBody" -ForegroundColor Yellow
        } catch {
            Write-Host "No se pudo leer detalles del error" -ForegroundColor Yellow
        }
    }
    exit 1
}

# Paso 3: Generar QR Interoperable
Write-Host "[3/4] Generando QR Interoperable..." -ForegroundColor Yellow
try {
    $qrBody = @{
        qrType = "dynamic"
    } | ConvertTo-Json
    
    $qrResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments/qr" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $qrBody `
        -ErrorAction Stop
    
    Write-Host "QR generado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "RESULTADO" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Payment ID: $($qrResponse.id)" -ForegroundColor White
    Write-Host "Status: $($qrResponse.status)" -ForegroundColor White
    Write-Host "Amount: $($qrResponse.amount)" -ForegroundColor White
    Write-Host ""
    
    if ($qrResponse.gateway_metadata) {
        $metadata = $qrResponse.gateway_metadata
        Write-Host "Gateway Metadata:" -ForegroundColor Yellow
        Write-Host "  Provider: $($metadata.provider)" -ForegroundColor Gray
        Write-Host "  Reference: $($metadata.reference)" -ForegroundColor Gray
        
        if ($metadata.expires_at) {
            Write-Host "  Expires At: $($metadata.expires_at)" -ForegroundColor Gray
        }
        
        if ($metadata.qr_code) {
            $qrCodeLength = $metadata.qr_code.Length
            Write-Host "  QR Code: [Base64 Image] ($qrCodeLength caracteres)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "QR Code disponible en: gateway_metadata.qr_code" -ForegroundColor Green
            Write-Host "Formato: data:image/png;base64,..." -ForegroundColor Gray
        }
        
        if ($metadata.qr_payload) {
            $payloadLength = $metadata.qr_payload.Length
            Write-Host "  QR Payload: [EMVCo] ($payloadLength caracteres)" -ForegroundColor Gray
            Write-Host "  Payload preview: $($metadata.qr_payload.Substring(0, [Math]::Min(50, $payloadLength)))..." -ForegroundColor DarkGray
        }
        
        Write-Host ""
        
        # Verificar que sea QR interoperable
        if ($metadata.provider -eq "interoperable_qr") {
            Write-Host "SUCCESS: QR Interoperable generado correctamente!" -ForegroundColor Green
            Write-Host "Este QR es escaneable por cualquier billetera (MODO, Naranja X, MP, Bancos)" -ForegroundColor Cyan
        } elseif ($metadata.provider -eq "generic_qr") {
            Write-Host "WARNING: Se genero QR generico (fallback)" -ForegroundColor Yellow
            Write-Host "Verifica que el gateway 'interoperable_qr' este configurado en payment_gateways" -ForegroundColor Yellow
        } else {
            Write-Host "INFO: Provider: $($metadata.provider)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "WARNING: No se encontro gateway_metadata en la respuesta" -ForegroundColor Yellow
    }
    
    Write-Host ""
} catch {
    Write-Host "ERROR al generar QR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Detalles: $errorBody" -ForegroundColor Yellow
            
            try {
                $errorJson = $errorBody | ConvertFrom-Json
                if ($errorJson.details) {
                    Write-Host "Detalles del error:" -ForegroundColor Yellow
                    $errorJson.details | ConvertTo-Json | Write-Host -ForegroundColor DarkGray
                }
            } catch {
                # No es JSON, mostrar como texto
            }
        } catch {
            Write-Host "No se pudo leer detalles del error" -ForegroundColor Yellow
        }
    }
    exit 1
}

# Paso 4: Verificar configuración del gateway
Write-Host "[4/4] Verificando configuracion del gateway..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Para verificar manualmente en Supabase:" -ForegroundColor Cyan
Write-Host "SELECT provider, enabled, config->>'merchant_cbu' as cbu, config->>'merchant_name' as nombre" -ForegroundColor DarkGray
Write-Host "FROM payment_gateways" -ForegroundColor DarkGray
Write-Host "WHERE provider = 'interoperable_qr' AND tenant_id = '$TenantId';" -ForegroundColor DarkGray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA COMPLETADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Yellow
Write-Host "1. Usa el QR Code (gateway_metadata.qr_code) en tu frontend" -ForegroundColor White
Write-Host "2. Escanea con cualquier billetera (MODO, Naranja X, MP, Banco)" -ForegroundColor White
Write-Host "3. Verifica que aparezca el monto y nombre del comercio" -ForegroundColor White
Write-Host ""

