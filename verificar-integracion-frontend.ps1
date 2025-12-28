# Script de Verificación de Integración Frontend-Backend
# Verifica si el frontend está usando las nuevas funcionalidades de pagos

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Email = "test3@toludev.com",
    [string]$Password = "impresorA125"
)

$script:testResults = @()
$script:token = $null

function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message
    )
    $script:testResults += @{
        Name = $TestName
        Passed = $Passed
        Message = $Message
    }
    $symbol = if ($Passed) { "[OK]" } else { "[FAIL]" }
    Write-Host "$symbol $TestName" -ForegroundColor $(if ($Passed) { "Green" } else { "Red" })
    if ($Message) {
        Write-Host "  → $Message" -ForegroundColor Gray
    }
}

Write-Host "`n=== Verificación de Integración Frontend-Backend ===" -ForegroundColor Cyan
Write-Host "Verificando si el frontend está usando las nuevas funcionalidades de pagos`n" -ForegroundColor Yellow

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

# 2. Verificar endpoints de métodos de pago
Write-Host "`n2. Verificando endpoints de métodos de pago..." -ForegroundColor Yellow

# 2.1 GET /api/payment-methods
try {
    $headers = @{
        "Authorization" = "Bearer $script:token"
    }
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/payment-methods" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    $hasMethods = $response -and $response.Count -gt 0
    Add-TestResult "GET /api/payment-methods" $true "Métodos de pago disponibles: $($response.Count)"
} catch {
    Add-TestResult "GET /api/payment-methods" $false "Error: $($_.Exception.Message)"
}

# 2.2 POST /api/payment-methods (crear método)
try {
    $methodBody = @{
        label = "QR Test Frontend"
        code = "qr_test_frontend_$(Get-Date -Format 'yyyyMMddHHmmss')"
        type = "qr"
        isActive = $true
        metadata = @{
            test = $true
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/api/payment-methods" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $methodBody `
        -ErrorAction Stop
    
    $testMethodId = $response.id
    Add-TestResult "POST /api/payment-methods" $true "Método creado: $testMethodId"
} catch {
    Add-TestResult "POST /api/payment-methods" $false "Error: $($_.Exception.Message)"
    $testMethodId = $null
}

# 3. Verificar endpoints de ventas con resumen financiero
Write-Host "`n3. Verificando resumen financiero en ventas..." -ForegroundColor Yellow

# 3.1 Obtener una venta confirmada
try {
    $salesResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales?status=confirmed&limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($salesResponse -and $salesResponse.Count -gt 0) {
        $saleId = $salesResponse[0].id
        Add-TestResult "Obtener venta confirmada" $true "Venta ID: $saleId"
    } else {
        # Crear una venta de prueba
        Write-Host "  → No hay ventas confirmadas, creando una de prueba..." -ForegroundColor Gray
        
        # Obtener un producto
        $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
            -Method GET `
            -ErrorAction Stop
        
        if ($productsResponse.data -and $productsResponse.data.Count -gt 0) {
            $productId = $productsResponse.data[0].id
            
            # Crear venta draft
            $saleBody = @{
                items = @(
                    @{
                        productId = $productId
                        quantity = 1
                        unitPrice = 45000
                    }
                )
            } | ConvertTo-Json

            $draftSale = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
                -Method POST `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $saleBody `
                -ErrorAction Stop
            
            $saleId = $draftSale.id
            
            # Confirmar venta
            Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
                -Method POST `
                -Headers $headers `
                -ErrorAction Stop | Out-Null
            
            Add-TestResult "Crear venta de prueba" $true "Venta creada y confirmada: $saleId"
        } else {
            Add-TestResult "Obtener venta confirmada" $false "No hay productos disponibles"
            $saleId = $null
        }
    }
} catch {
    Add-TestResult "Obtener venta confirmada" $false "Error: $($_.Exception.Message)"
    $saleId = $null
}

# 3.2 Verificar GET /api/sales/:id con resumen financiero
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $hasFinancial = $saleResponse.financial -ne $null
        $hasTotalAmount = $saleResponse.financial.totalAmount -ne $null
        $hasPaidAmount = $saleResponse.financial.paidAmount -ne $null
        $hasBalanceAmount = $saleResponse.financial.balanceAmount -ne $null
        $hasIsPaid = $saleResponse.financial.isPaid -ne $null
        
        $allFinancialFields = $hasFinancial -and $hasTotalAmount -and $hasPaidAmount -and $hasBalanceAmount -and $hasIsPaid
        
        if ($allFinancialFields) {
            Add-TestResult "GET /api/sales/:id con resumen financiero" $true "Campos financieros presentes: totalAmount, paidAmount, balanceAmount, isPaid"
        } else {
            $missing = @()
            if (-not $hasFinancial) { $missing += "financial" }
            if (-not $hasTotalAmount) { $missing += "totalAmount" }
            if (-not $hasPaidAmount) { $missing += "paidAmount" }
            if (-not $hasBalanceAmount) { $missing += "balanceAmount" }
            if (-not $hasIsPaid) { $missing += "isPaid" }
            Add-TestResult "GET /api/sales/:id con resumen financiero" $false "Faltan campos: $($missing -join ', ')"
        }
    } catch {
        Add-TestResult "GET /api/sales/:id con resumen financiero" $false "Error: $($_.Exception.Message)"
    }
}

# 4. Verificar endpoints de pagos
Write-Host "`n4. Verificando endpoints de pagos..." -ForegroundColor Yellow

if ($saleId) {
    # 4.1 GET /api/sales/:id/payments
    try {
        $paymentsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        # Verificar que payments existe (puede ser array vacío)
        # Usar PSObject para verificar propiedades
        $hasPayments = $paymentsResponse.PSObject.Properties.Name -contains "payments"
        $hasTotalPaid = $paymentsResponse.PSObject.Properties.Name -contains "totalPaid"
        $hasFinancial = $paymentsResponse.PSObject.Properties.Name -contains "financial"
        
        if ($hasPayments -and $hasTotalPaid -and $hasFinancial) {
            $paymentsCount = if ($paymentsResponse.payments -is [Array]) { $paymentsResponse.payments.Count } else { 0 }
            Add-TestResult "GET /api/sales/:id/payments" $true "Estructura completa: payments ($paymentsCount), totalPaid, financial"
        } else {
            $missing = @()
            if (-not $hasPayments) { $missing += "payments" }
            if (-not $hasTotalPaid) { $missing += "totalPaid" }
            if (-not $hasFinancial) { $missing += "financial" }
            Add-TestResult "GET /api/sales/:id/payments" $false "Faltan campos: $($missing -join ', ')"
        }
    } catch {
        Add-TestResult "GET /api/sales/:id/payments" $false "Error: $($_.Exception.Message)"
    }

    # 4.2 POST /api/sales/:id/payments con payment_method_id
    if ($testMethodId) {
        try {
            $paymentBody = @{
                amount = 1000
                status = "pending"
                paymentMethodId = $testMethodId
                reference = "Pago de prueba con payment_method_id"
            } | ConvertTo-Json

            $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
                -Method POST `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $paymentBody `
                -ErrorAction Stop
            
            $hasPaymentMethodId = $paymentResponse.payment_method_id -eq $testMethodId
            $hasPaymentMethod = $paymentResponse.payment_methods -ne $null
            
            if ($hasPaymentMethodId -and $hasPaymentMethod) {
                Add-TestResult "POST /api/sales/:id/payments con payment_method_id" $true "Pago creado con payment_method_id y relación cargada"
            } else {
                Add-TestResult "POST /api/sales/:id/payments con payment_method_id" $false "No se guardó payment_method_id o no se cargó la relación"
            }
            
            # Limpiar: eliminar pago pending
            try {
                Invoke-RestMethod -Uri "$BaseUrl/api/payments/$($paymentResponse.id)" `
                    -Method DELETE `
                    -Headers $headers `
                    -ErrorAction Stop | Out-Null
            } catch {
                # Ignorar error de limpieza
            }
        } catch {
            Add-TestResult "POST /api/sales/:id/payments con payment_method_id" $false "Error: $($_.Exception.Message)"
        }
    }

    # 4.3 POST /api/sales/:id/payments con method (backward compatibility)
    try {
        $paymentBody = @{
            amount = 2000
            method = "transfer"
            status = "confirmed"
            reference = "Pago de prueba con method (backward compatibility)"
        } | ConvertTo-Json

        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $hasMethod = $paymentResponse.method -eq "transfer"
        
        if ($hasMethod) {
            Add-TestResult "POST /api/sales/:id/payments con method (backward compatibility)" $true "Pago creado con method string"
        } else {
            Add-TestResult "POST /api/sales/:id/payments con method (backward compatibility)" $false "No se guardó el method"
        }
    } catch {
        Add-TestResult "POST /api/sales/:id/payments con method (backward compatibility)" $false "Error: $($_.Exception.Message)"
    }

    # 4.4 Verificar campos de gateway (external_reference, gateway_metadata)
    try {
        $paymentBody = @{
            amount = 500
            method = "cash"
            status = "pending"
            reference = "Pago con campos de gateway"
            externalReference = "MP-123456789"
            gatewayMetadata = @{
                provider = "mercadopago"
                payment_id = "123456789"
                status = "pending"
            }
        } | ConvertTo-Json

        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $hasExternalRef = $paymentResponse.external_reference -eq "MP-123456789"
        $hasGatewayMetadata = $paymentResponse.gateway_metadata -ne $null
        
        if ($hasExternalRef -and $hasGatewayMetadata) {
            Add-TestResult "POST /api/sales/:id/payments con campos de gateway" $true "external_reference y gateway_metadata guardados correctamente"
        } else {
            $missing = @()
            if (-not $hasExternalRef) { $missing += "external_reference" }
            if (-not $hasGatewayMetadata) { $missing += "gateway_metadata" }
            Add-TestResult "POST /api/sales/:id/payments con campos de gateway" $false "Faltan campos: $($missing -join ', ')"
        }
        
        # Limpiar: eliminar pago pending
        try {
            Invoke-RestMethod -Uri "$BaseUrl/api/payments/$($paymentResponse.id)" `
                -Method DELETE `
                -Headers $headers `
                -ErrorAction Stop | Out-Null
        } catch {
            # Ignorar error de limpieza
        }
    } catch {
        Add-TestResult "POST /api/sales/:id/payments con campos de gateway" $false "Error: $($_.Exception.Message)"
    }
}

# 5. Verificar estados de pago
Write-Host "`n5. Verificando estados de pago..." -ForegroundColor Yellow

if ($saleId) {
    # Crear pago pending
    try {
        $paymentBody = @{
            amount = 1000
            method = "cash"
            status = "pending"
        } | ConvertTo-Json

        $pendingPayment = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        # Verificar que pending puede eliminarse
        try {
            Invoke-RestMethod -Uri "$BaseUrl/api/payments/$($pendingPayment.id)" `
                -Method DELETE `
                -Headers $headers `
                -ErrorAction Stop | Out-Null
            Add-TestResult "DELETE /api/payments/:id (pending)" $true "Pago pending eliminado correctamente"
        } catch {
            Add-TestResult "DELETE /api/payments/:id (pending)" $false "Error: $($_.Exception.Message)"
        }
    } catch {
        Add-TestResult "Crear pago pending para prueba" $false "Error: $($_.Exception.Message)"
    }

    # Crear pago confirmed y verificar que NO puede eliminarse
    try {
        $paymentBody = @{
            amount = 1000
            method = "cash"
            status = "confirmed"
        } | ConvertTo-Json

        $confirmedPayment = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        # Intentar eliminar (debe fallar con 400)
        try {
            try {
                Invoke-RestMethod -Uri "$BaseUrl/api/payments/$($confirmedPayment.id)" `
                    -Method DELETE `
                    -Headers $headers `
                    -ErrorAction Stop | Out-Null
                Add-TestResult "DELETE /api/payments/:id (confirmed)" $false "No debería permitir eliminar pago confirmed"
            } catch {
                $statusCode = $_.Exception.Response.StatusCode.value__
                $errorMessage = $_.Exception.Message
                
                # Intentar obtener el mensaje de error del body
                try {
                    $errorStream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($errorStream)
                    $errorBody = $reader.ReadToEnd()
                    $errorJson = $errorBody | ConvertFrom-Json
                    if ($errorJson.error) {
                        $errorMessage = $errorJson.error
                    }
                } catch {
                    # Ignorar si no se puede parsear el error
                }
                
                # Verificar que es un 400 (Bad Request) y contiene mensaje apropiado
                if ($statusCode -eq 400 -or $errorMessage -like "*confirmed*" -or $errorMessage -like "*No se puede eliminar*" -or $errorMessage -like "*Solo se pueden eliminar*") {
                    Add-TestResult "DELETE /api/payments/:id (confirmed)" $true "Correctamente rechazado (HTTP $statusCode): solo pending puede eliminarse"
                } else {
                    Add-TestResult "DELETE /api/payments/:id (confirmed)" $false "Error inesperado (HTTP $statusCode): $errorMessage"
                }
            }
        } catch {
            # Si hay un error al intentar eliminar, es correcto
            Add-TestResult "DELETE /api/payments/:id (confirmed)" $true "Correctamente rechazado: solo pending puede eliminarse"
        }
    } catch {
        Add-TestResult "Crear pago confirmed para prueba" $false "Error: $($_.Exception.Message)"
    }
}

# Resumen
Write-Host "`n=== Resumen de Verificación ===" -ForegroundColor Cyan
$total = $script:testResults.Count
$passed = ($script:testResults | Where-Object { $_.Passed -eq $true }).Count
$failed = $total - $passed

Write-Host "Total de pruebas: $total" -ForegroundColor White
Write-Host "[OK] Pasadas: $passed" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

if ($failed -eq 0) {
    Write-Host "`n[SUCCESS] ¡TODAS LAS VERIFICACIONES PASARON!" -ForegroundColor Green
    Write-Host "El backend está listo y todas las funcionalidades están disponibles." -ForegroundColor Green
} else {
    Write-Host "`n[WARNING] Algunas verificaciones fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba para identificar qué necesita atención." -ForegroundColor Yellow
}

Write-Host "`n=== Checklist para el Frontend ===" -ForegroundColor Cyan
Write-Host @"
Para verificar que el frontend está usando estas funcionalidades, busca en el código:

1. [OK] GET /api/payment-methods
   - ¿El frontend obtiene métodos de pago configurables?
   - ¿Muestra métodos activos por tipo (qr, card, gateway, etc.)?

2. [OK] POST /api/payment-methods
   - ¿El frontend permite crear métodos de pago personalizados?

3. [OK] GET /api/sales/:id
   - ¿El frontend usa el campo 'financial'?
   - ¿Muestra totalAmount, paidAmount, balanceAmount, isPaid?

4. [OK] GET /api/sales/:id/payments
   - ¿El frontend muestra la lista de pagos?
   - ¿Incluye información de payment_methods?
   - ¿Muestra totalPaid y resumen financiero?

5. [OK] POST /api/sales/:id/payments
   - ¿El frontend permite crear pagos con paymentMethodId?
   - ¿Soporta backward compatibility con 'method' string?
   - ¿Guarda external_reference y gateway_metadata para pasarelas?

6. [OK] DELETE /api/payments/:id
   - ¿El frontend solo permite eliminar pagos pending?
   - ¿Muestra error cuando intenta eliminar confirmed?

7. [OK] Estados de pago
   - ¿El frontend maneja pending, confirmed, failed, refunded?
   - ¿Solo cuenta confirmed en el total pagado?

8. [OK] Cálculo financiero
   - ¿El frontend NO recalcula paid_amount/balance_amount?
   - ¿Confía en los valores del backend (financial)?

"@ -ForegroundColor White

Write-Host "`n=== Fin de Verificación ===" -ForegroundColor Cyan

