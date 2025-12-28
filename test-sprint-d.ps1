# Script de Pruebas - SPRINT D: Mercado Pago (Pago Online)
# Verifica que la integración con Mercado Pago funcione correctamente

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Email = "test3@toludev.com",
    [string]$Password = "impresorA125"
)

$script:token = $null
$script:testResults = @()
$script:testCount = 0
$script:passCount = 0
$script:failCount = 0

function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message
    )
    
    $script:testCount++
    if ($Passed) {
        $script:passCount++
        Write-Host "[OK] $TestName" -ForegroundColor Green
        Write-Host "  -> $Message" -ForegroundColor Gray
    } else {
        $script:failCount++
        Write-Host "[FAIL] $TestName" -ForegroundColor Red
        Write-Host "  -> $Message" -ForegroundColor Yellow
    }
    
    $script:testResults += @{
        Test = $TestName
        Passed = $Passed
        Message = $Message
    }
}

Write-Host "`n=== Pruebas SPRINT D - Mercado Pago (Pago Online) ===" -ForegroundColor Cyan
Write-Host "Verificando integracion con Mercado Pago y creacion de checkout`n" -ForegroundColor Yellow
Write-Host "[NOTA] Este test requiere un Access Token valido de Mercado Pago." -ForegroundColor Yellow
Write-Host "Si obtienes error 'invalid access token', configura un token real en el gateway.`n" -ForegroundColor Yellow

# 1. Autenticación
Write-Host "1. Autenticando..." -ForegroundColor Yellow
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

    $script:token = $loginResponse.session.access_token
    Add-TestResult "Autenticacion" $true "Token obtenido correctamente"
} catch {
    Add-TestResult "Autenticacion" $false "Error: $($_.Exception.Message)"
    Write-Host "`n[ERROR] No se pudo autenticar. Verifica las credenciales." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $script:token"
    "Content-Type" = "application/json"
}

# 2. Configurar gateway de Mercado Pago
Write-Host "`n2. Configurando gateway de Mercado Pago..." -ForegroundColor Yellow
$gatewayId = $null
try {
    # Verificar si ya existe
    $existingGateways = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    $mpGateway = $existingGateways | Where-Object { $_.provider -eq "mercadopago" } | Select-Object -First 1
    
    if ($mpGateway) {
        $gatewayId = $mpGateway.id
        # Actualizar para habilitarlo
        # NOTA: Usa un Access Token real de Mercado Pago para que funcione
        $accessToken = $env:MERCADOPAGO_ACCESS_TOKEN
        if (-not $accessToken) {
            Write-Host "  [WARNING] Variable de entorno MERCADOPAGO_ACCESS_TOKEN no configurada." -ForegroundColor Yellow
            Write-Host "  Usando token de prueba (puede fallar). Configura MERCADOPAGO_ACCESS_TOKEN para usar un token real." -ForegroundColor Yellow
            $accessToken = "TEST-1234567890-123456-1234567890abcdef1234567890abcdef12-123456789"
        }
        
        $updateBody = @{
            enabled = $true
            credentials = @{
                access_token = $accessToken
            }
            config = @{
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
        } | ConvertTo-Json -Depth 10

        $updatedGateway = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
            -Method PUT `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $updateBody `
            -ErrorAction Stop
        
        Add-TestResult "Configurar gateway MP" $true "Gateway existente habilitado ID: $gatewayId"
    } else {
        # Crear nuevo gateway
        $gatewayBody = @{
            provider = "mercadopago"
            enabled = $true
            credentials = @{
                access_token = "TEST-1234567890-123456-1234567890abcdef1234567890abcdef12-123456789"
            }
            config = @{
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
        } | ConvertTo-Json -Depth 10

        $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $gatewayBody `
            -ErrorAction Stop
        
        $gatewayId = $gatewayResponse.id
        Add-TestResult "Configurar gateway MP" $true "Gateway creado ID: $gatewayId"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        # Gateway ya existe, obtenerlo
        try {
            $allGateways = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways" `
                -Method GET `
                -Headers $headers `
                -ErrorAction Stop
            
            $mpGateway = $allGateways | Where-Object { $_.provider -eq "mercadopago" } | Select-Object -First 1
            if ($mpGateway) {
                $gatewayId = $mpGateway.id
                Add-TestResult "Configurar gateway MP" $true "Gateway ya existe ID: $gatewayId"
            } else {
                Add-TestResult "Configurar gateway MP" $false "Error: Gateway ya existe pero no se pudo obtener"
            }
        } catch {
            Add-TestResult "Configurar gateway MP" $false "Error: $($_.Exception.Message)"
        }
    } else {
        Add-TestResult "Configurar gateway MP" $false "Error: $($_.Exception.Message)"
    }
}

# 3. Crear venta confirmada para pruebas
Write-Host "`n3. Creando venta confirmada para pruebas..." -ForegroundColor Yellow
$saleId = $null
try {
    # Obtener producto
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($productsResponse.data -and $productsResponse.data.Count -gt 0) {
        $product = $productsResponse.data[0]
        
        # Crear venta
        $saleBody = @{
            items = @(
                @{
                    productId = $product.id
                    quantity = 1
                    unitPrice = 5000
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
        
        # Confirmar venta
        Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop | Out-Null
        
        Add-TestResult "Crear venta confirmada" $true "Venta creada y confirmada ID: $saleId"
    } else {
        Add-TestResult "Crear venta confirmada" $false "No hay productos disponibles"
        exit 1
    }
} catch {
    Add-TestResult "Crear venta confirmada" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 4. Crear pago con Mercado Pago
Write-Host "`n4. Creando pago con Mercado Pago..." -ForegroundColor Yellow
$paymentId = $null
$checkoutUrl = $null
$externalRef = $null
if ($saleId) {
    try {
        $mpResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments/mercadopago" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        $paymentId = $mpResponse.id
        $checkoutUrl = $mpResponse.checkoutUrl
        $externalRef = $mpResponse.external_reference
        
        $hasRequiredFields = $checkoutUrl -ne $null `
            -and $mpResponse.payment_id -ne $null `
            -and $externalRef -eq $saleId `
            -and $mpResponse.status -eq "pending"
        
        if ($hasRequiredFields) {
            Add-TestResult "Crear pago MP" $true "Pago creado ID: $paymentId, checkoutUrl presente, external_reference=$externalRef"
        } else {
            Add-TestResult "Crear pago MP" $false "Faltan campos requeridos: checkoutUrl=$($checkoutUrl -ne $null), payment_id=$($mpResponse.payment_id -ne $null), external_reference=$externalRef, status=$($mpResponse.status)"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
        if ($errorDetails) {
            Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
            try {
                $errorJson = $errorDetails | ConvertFrom-Json
                Add-TestResult "Crear pago MP" $false "Error: $($errorJson.message)"
            } catch {
                Add-TestResult "Crear pago MP" $false "Error: $($_.Exception.Message)"
            }
        } else {
            Add-TestResult "Crear pago MP" $false "Error: $($_.Exception.Message)"
        }
    }
}

# 5. Verificar que el pago quedó en estado pending
Write-Host "`n5. Verificando estado del pago..." -ForegroundColor Yellow
if ($paymentId) {
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $payment = $paymentResponse.payments | Where-Object { $_.id -eq $paymentId }
        
        if ($payment) {
            $isPending = $payment.status -eq "pending"
            $isMercadopago = $payment.method -eq "mercadopago"
            $hasExternalRef = $payment.external_reference -ne $null
            
            if ($isPending -and $isMercadopago -and $hasExternalRef) {
                Add-TestResult "Estado del pago" $true "Status: pending, method: mercadopago, external_reference presente"
            } else {
                Add-TestResult "Estado del pago" $false "Status: $($payment.status), method: $($payment.method), external_reference: $($payment.external_reference)"
            }
        } else {
            Add-TestResult "Estado del pago" $false "No se encontro el pago"
        }
    } catch {
        Add-TestResult "Estado del pago" $false "Error: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "Estado del pago" $false "No hay payment ID disponible"
}

# 6. Verificar idempotencia (crear mismo pago dos veces)
Write-Host "`n6. Probando idempotencia..." -ForegroundColor Yellow
if ($saleId) {
    try {
        # Segunda llamada al mismo endpoint
        $mpResponse2 = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments/mercadopago" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        $isSamePayment = $mpResponse2.id -eq $paymentId
        
        if ($isSamePayment) {
            Add-TestResult "Idempotencia" $true "Mismo pago retornado (ID: $paymentId), no se creo duplicado"
        } else {
            Add-TestResult "Idempotencia" $false "Se crearon pagos diferentes: $paymentId vs $($mpResponse2.id)"
        }
    } catch {
        Add-TestResult "Idempotencia" $false "Error: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "Idempotencia" $false "No hay sale ID disponible"
}

# 7. Verificar que checkoutUrl es válido
Write-Host "`n7. Verificando checkoutUrl..." -ForegroundColor Yellow
if ($checkoutUrl) {
    try {
        # Verificar que es una URL válida
        $uri = [System.Uri]$checkoutUrl
        $isValidUrl = $uri.Scheme -eq "https" -or $uri.Scheme -eq "http"
        $containsMercadopago = $checkoutUrl -like "*mercadopago*" -or $checkoutUrl -like "*mp*"
        
        if ($isValidUrl) {
            Add-TestResult "CheckoutUrl valido" $true "URL valida: $checkoutUrl"
        } else {
            Add-TestResult "CheckoutUrl valido" $false "URL invalida: $checkoutUrl"
        }
    } catch {
        Add-TestResult "CheckoutUrl valido" $false "Error al validar URL: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "CheckoutUrl valido" $false "No hay checkoutUrl disponible"
}

# 8. Verificar gateway_metadata
Write-Host "`n8. Verificando gateway_metadata..." -ForegroundColor Yellow
if ($paymentId) {
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $payment = $paymentResponse.payments | Where-Object { $_.id -eq $paymentId }
        
        if ($payment -and $payment.gateway_metadata) {
            $metadata = $payment.gateway_metadata
            $hasProvider = $metadata.provider -eq "mercadopago"
            $hasPreferenceId = $metadata.preference_id -ne $null
            $hasInitPoint = $metadata.init_point -ne $null
            
            if ($hasProvider -and $hasPreferenceId -and $hasInitPoint) {
                Add-TestResult "Gateway metadata" $true "Metadata completo: provider, preference_id, init_point presentes"
            } else {
                Add-TestResult "Gateway metadata" $false "Faltan campos: provider=$hasProvider, preference_id=$hasPreferenceId, init_point=$hasInitPoint"
            }
        } else {
            Add-TestResult "Gateway metadata" $false "No se encontro gateway_metadata"
        }
    } catch {
        Add-TestResult "Gateway metadata" $false "Error: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "Gateway metadata" $false "No hay payment ID disponible"
}

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint D esta funcionando correctamente." -ForegroundColor Green
    Write-Host "`nPuedes continuar con el Sprint E (Webhooks & Confirmacion)." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

