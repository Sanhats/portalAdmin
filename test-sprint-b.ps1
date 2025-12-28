# Script de Pruebas - SPRINT B: Normalización de Pagos (Pre-Gateway)
# Verifica que los endpoints funcionen correctamente con clasificación manual/gateway e idempotencia

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
        Write-Host "  → $Message" -ForegroundColor Gray
    } else {
        $script:failCount++
        Write-Host "[FAIL] $TestName" -ForegroundColor Red
        Write-Host "  → $Message" -ForegroundColor Yellow
    }
    
    $script:testResults += @{
        Test = $TestName
        Passed = $Passed
        Message = $Message
    }
}

Write-Host "`n=== Pruebas SPRINT B - Normalización de Pagos (Pre-Gateway) ===" -ForegroundColor Cyan
Write-Host "Verificando clasificación manual/gateway, reglas de estado e idempotencia`n" -ForegroundColor Yellow

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
    Add-TestResult "Autenticación" $true "Token obtenido correctamente"
} catch {
    Add-TestResult "Autenticación" $false "Error: $($_.Exception.Message)"
    Write-Host "`n[ERROR] No se pudo autenticar. Verifica las credenciales." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $script:token"
    "Content-Type" = "application/json"
}

# 2. Crear método de pago manual
Write-Host "`n2. Creando método de pago manual..." -ForegroundColor Yellow
$manualMethodId = $null
try {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $methodBody = @{
        code = "cash_test_$timestamp"
        label = "Efectivo de Prueba"
        type = "cash"
        paymentCategory = "manual"
        isActive = $true
    } | ConvertTo-Json

    $methodResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-methods" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $methodBody `
        -ErrorAction Stop
    
    $manualMethodId = $methodResponse.id
    $hasCategory = $methodResponse.payment_category -eq "manual"
    
    if ($hasCategory) {
        Add-TestResult "Crear método manual" $true "Método creado ID: $manualMethodId, payment_category: manual"
    } else {
        Add-TestResult "Crear método manual" $false "payment_category no es 'manual': $($methodResponse.payment_category)"
    }
} catch {
    Add-TestResult "Crear método manual" $false "Error: $($_.Exception.Message)"
}

# 3. Crear método de pago gateway
Write-Host "`n3. Creando método de pago gateway..." -ForegroundColor Yellow
$gatewayMethodId = $null
try {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $methodBody = @{
        code = "qr_test_$timestamp"
        label = "QR de Prueba"
        type = "qr"
        paymentCategory = "gateway"
        isActive = $true
    } | ConvertTo-Json

    $methodResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-methods" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $methodBody `
        -ErrorAction Stop
    
    $gatewayMethodId = $methodResponse.id
    $hasCategory = $methodResponse.payment_category -eq "gateway"
    
    if ($hasCategory) {
        Add-TestResult "Crear método gateway" $true "Método creado ID: $gatewayMethodId, payment_category: gateway"
    } else {
        Add-TestResult "Crear método gateway" $false "payment_category no es 'gateway': $($methodResponse.payment_category)"
    }
} catch {
    Add-TestResult "Crear método gateway" $false "Error: $($_.Exception.Message)"
}

# 4. Obtener venta confirmada para pruebas
Write-Host "`n4. Obteniendo venta confirmada para pruebas..." -ForegroundColor Yellow
$saleId = $null
try {
    $salesResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales?status=confirmed&limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($salesResponse.data -and $salesResponse.data.Count -gt 0) {
        $saleId = $salesResponse.data[0].id
        Add-TestResult "Obtener venta confirmada" $true "Venta obtenida ID: $saleId"
    } else {
        # Crear venta de prueba
        $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        if ($productsResponse.data -and $productsResponse.data.Count -gt 0) {
            $product = $productsResponse.data[0]
            $saleBody = @{
                items = @(
                    @{
                        productId = $product.id
                        quantity = 1
                        unitPrice = 1000
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
            
            Add-TestResult "Crear y confirmar venta" $true "Venta creada y confirmada ID: $saleId"
        } else {
            Add-TestResult "Obtener venta confirmada" $false "No hay productos disponibles"
            exit 1
        }
    }
} catch {
    Add-TestResult "Obtener venta confirmada" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 5. Crear pago manual (debe iniciar en confirmed)
Write-Host "`n5. Creando pago manual (debe iniciar en confirmed)..." -ForegroundColor Yellow
$manualPaymentId = $null
if ($saleId -and $manualMethodId) {
    try {
        $paymentBody = @{
            amount = 500
            paymentMethodId = $manualMethodId
            reference = "Pago manual de prueba"
        } | ConvertTo-Json

        Write-Host "  Enviando request body: $paymentBody" -ForegroundColor Gray
        
        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $manualPaymentId = $paymentResponse.id
        $isConfirmed = $paymentResponse.status -eq "confirmed"
        
        Write-Host "  Response completo:" -ForegroundColor Gray
        Write-Host "    ID: $($paymentResponse.id)" -ForegroundColor Gray
        Write-Host "    Status recibido: $($paymentResponse.status)" -ForegroundColor Gray
        Write-Host "    Method: $($paymentResponse.method)" -ForegroundColor Gray
        Write-Host "    Payment Method ID: $($paymentResponse.payment_method_id)" -ForegroundColor Gray
        
        if ($isConfirmed) {
            Add-TestResult "Pago manual inicia en confirmed" $true "Pago creado ID: $manualPaymentId, status: confirmed"
        } else {
            Add-TestResult "Pago manual inicia en confirmed" $false "Status incorrecto: $($paymentResponse.status), esperado: confirmed. Payment Method ID: $manualMethodId"
        }
    } catch {
        $errorDetails = $_.ErrorDetails.Message
        if ($errorDetails) {
            try {
                $errorJson = $errorDetails | ConvertFrom-Json
                Write-Host "  Error detallado: $($errorJson | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
            } catch {
                Write-Host "  Error: $errorDetails" -ForegroundColor Yellow
            }
        }
        Add-TestResult "Pago manual inicia en confirmed" $false "Error: $($_.Exception.Message)"
    }
}

# 6. Crear pago gateway (debe iniciar en pending)
Write-Host "`n6. Creando pago gateway (debe iniciar en pending)..." -ForegroundColor Yellow
$gatewayPaymentId = $null
if ($saleId -and $gatewayMethodId) {
    try {
        $paymentBody = @{
            amount = 500
            paymentMethodId = $gatewayMethodId
            reference = "Pago gateway de prueba"
        } | ConvertTo-Json

        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $gatewayPaymentId = $paymentResponse.id
        $isPending = $paymentResponse.status -eq "pending"
        
        if ($isPending) {
            Add-TestResult "Pago gateway inicia en pending" $true "Pago creado ID: $gatewayPaymentId, status: pending"
        } else {
            Add-TestResult "Pago gateway inicia en pending" $false "Status incorrecto: $($paymentResponse.status), esperado: pending"
        }
    } catch {
        Add-TestResult "Pago gateway inicia en pending" $false "Error: $($_.Exception.Message)"
    }
}

# 7. Intentar crear pago gateway como confirmed (debe fallar)
Write-Host "`n7. Intentando crear pago gateway como confirmed (debe fallar)..." -ForegroundColor Yellow
if ($saleId -and $gatewayMethodId) {
    try {
        $paymentBody = @{
            amount = 500
            paymentMethodId = $gatewayMethodId
            status = "confirmed"
            reference = "Intento de pago gateway como confirmed"
        } | ConvertTo-Json

        try {
            Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
                -Method POST `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $paymentBody `
                -ErrorAction Stop | Out-Null
            
            Add-TestResult "Gateway no puede iniciar en confirmed" $false "No debería permitir crear gateway como confirmed"
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 400) {
                Add-TestResult "Gateway no puede iniciar en confirmed" $true "Correctamente rechazado (HTTP 400)"
            } else {
                Add-TestResult "Gateway no puede iniciar en confirmed" $false "Error inesperado (HTTP $statusCode)"
            }
        }
    } catch {
        Add-TestResult "Gateway no puede iniciar en confirmed" $false "Error: $($_.Exception.Message)"
    }
}

# 8. Probar idempotencia (crear mismo pago dos veces)
Write-Host "`n8. Probando idempotencia (crear mismo pago dos veces)..." -ForegroundColor Yellow
$duplicatePaymentId = $null
if ($saleId -and $manualMethodId) {
    try {
        $externalRef = "TEST-IDEMPOTENCY-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $paymentBody = @{
            amount = 300
            paymentMethodId = $manualMethodId
            externalReference = $externalRef
            reference = "Pago para prueba de idempotencia"
        } | ConvertTo-Json

        # Primera creación
        $firstPayment = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $firstPaymentId = $firstPayment.id
        
        # Segunda creación (debe retornar el mismo pago)
        Start-Sleep -Seconds 1
        $secondPayment = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $isSamePayment = $secondPayment.id -eq $firstPaymentId
        
        if ($isSamePayment) {
            Add-TestResult "Idempotencia" $true "Mismo pago retornado (ID: $firstPaymentId), no se creó duplicado"
            $duplicatePaymentId = $firstPaymentId
        } else {
            Add-TestResult "Idempotencia" $false "Se crearon pagos diferentes: $firstPaymentId vs $($secondPayment.id)"
        }
    } catch {
        Add-TestResult "Idempotencia" $false "Error: $($_.Exception.Message)"
    }
}

# 9. Crear intención de pago
Write-Host "`n9. Creando intención de pago..." -ForegroundColor Yellow
$paymentIntentId = $null
if ($saleId) {
    try {
        $expiresAt = (Get-Date).AddHours(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $intentBody = @{
            saleId = $saleId
            amount = 1000
            gateway = "mercadopago"
            expiresAt = $expiresAt
            gatewayMetadata = @{
                test = $true
                provider = "mercadopago"
            }
        } | ConvertTo-Json -Depth 10

        $intentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-intents" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $intentBody `
            -ErrorAction Stop
        
        $paymentIntentId = $intentResponse.id
        $hasRequiredFields = $intentResponse.sale_id -eq $saleId `
            -and $intentResponse.gateway -eq "mercadopago" `
            -and $intentResponse.status -eq "created" `
            -and $intentResponse.amount -ne $null
        
        if ($hasRequiredFields) {
            Add-TestResult "Crear intención de pago" $true "Intención creada ID: $paymentIntentId, status: created"
        } else {
            Add-TestResult "Crear intención de pago" $false "Faltan campos requeridos"
        }
    } catch {
        Add-TestResult "Crear intención de pago" $false "Error: $($_.Exception.Message)"
    }
}

# 10. Actualizar intención de pago
Write-Host "`n10. Actualizando intención de pago..." -ForegroundColor Yellow
if ($paymentIntentId) {
    try {
        $updateBody = @{
            status = "processing"
            externalReference = "MP-123456789"
            gatewayMetadata = @{
                test = $true
                provider = "mercadopago"
                payment_id = "MP-123456789"
            }
        } | ConvertTo-Json -Depth 10

        $updatedIntent = Invoke-RestMethod -Uri "$BaseUrl/api/payment-intents/$paymentIntentId" `
            -Method PUT `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $updateBody `
            -ErrorAction Stop
        
        $isUpdated = $updatedIntent.status -eq "processing" `
            -and $updatedIntent.external_reference -eq "MP-123456789"
        
        if ($isUpdated) {
            Add-TestResult "Actualizar intención de pago" $true "Intención actualizada, status: processing"
        } else {
            Add-TestResult "Actualizar intención de pago" $false "No se actualizó correctamente"
        }
    } catch {
        Add-TestResult "Actualizar intención de pago" $false "Error: $($_.Exception.Message)"
    }
}

# 11. Listar intenciones de pago
Write-Host "`n11. Listando intenciones de pago..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $intentsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-intents?saleId=$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $hasIntents = $intentsResponse -is [Array] -or ($intentsResponse.Count -ge 0)
        
        if ($hasIntents) {
            $count = if ($intentsResponse -is [Array]) { $intentsResponse.Count } else { $intentsResponse.Count }
            Add-TestResult "Listar intenciones de pago" $true "Intenciones encontradas: $count"
        } else {
            Add-TestResult "Listar intenciones de pago" $false "Respuesta inválida"
        }
    } catch {
        Add-TestResult "Listar intenciones de pago" $false "Error: $($_.Exception.Message)"
    }
}

# Limpiar: eliminar pagos de prueba (solo pending)
Write-Host "`nLimpiando pagos de prueba..." -ForegroundColor Yellow
if ($gatewayPaymentId) {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/payments/$gatewayPaymentId" `
            -Method DELETE `
            -Headers $headers `
            -ErrorAction Stop | Out-Null
    } catch {
        # Ignorar error de limpieza
    }
}

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] ¡TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint B está funcionando correctamente." -ForegroundColor Green
    Write-Host "`nPuedes continuar con el Sprint C." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

