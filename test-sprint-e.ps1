# Script de Pruebas - SPRINT E: Webhooks & Confirmacion
# Verifica que los webhooks de Mercado Pago funcionen correctamente

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

Write-Host "`n=== Pruebas SPRINT E - Webhooks & Confirmacion ===" -ForegroundColor Cyan
Write-Host "Verificando procesamiento de webhooks y transicion de estados`n" -ForegroundColor Yellow

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

# 2. Crear venta y pago con Mercado Pago
Write-Host "`n2. Creando venta y pago con Mercado Pago..." -ForegroundColor Yellow
$saleId = $null
$paymentId = $null
$preferenceId = $null
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
                    unitPrice = 3000
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
        
        # Crear pago con Mercado Pago
        $mpResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments/mercadopago" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        $paymentId = $mpResponse.id
        $preferenceId = $mpResponse.payment_id
        
        Add-TestResult "Crear venta y pago MP" $true "Venta ID: $saleId, Pago ID: $paymentId, Preference ID: $preferenceId"
    } else {
        Add-TestResult "Crear venta y pago MP" $false "No hay productos disponibles"
        exit 1
    }
} catch {
    Add-TestResult "Crear venta y pago MP" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 3. Simular webhook de pago aprobado (approved → confirmed)
Write-Host "`n3. Simulando webhook de pago aprobado..." -ForegroundColor Yellow
if ($paymentId -and $preferenceId) {
    try {
        # Obtener el pago actual para verificar estado inicial
        $paymentBefore = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $currentPayment = $paymentBefore.payments | Where-Object { $_.id -eq $paymentId }
        $initialStatus = $currentPayment.status
        
        # Simular webhook de Mercado Pago (formato real)
        $webhookBody = @{
            type = "payment"
            data = @{
                id = $preferenceId
                status = "approved"
                status_detail = "accredited"
                transaction_amount = 3000
                external_reference = $saleId
                date_created = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            }
        } | ConvertTo-Json -Depth 10

        # Enviar webhook (sin autenticación, es público)
        $webhookResponse = Invoke-RestMethod -Uri "$BaseUrl/api/webhooks/mercadopago" `
            -Method POST `
            -ContentType "application/json" `
            -Body $webhookBody `
            -ErrorAction Stop
        
        # Esperar un momento para que se procese
        Start-Sleep -Seconds 2
        
        # Verificar que el pago cambió a confirmed
        $paymentAfter = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $updatedPayment = $paymentAfter.payments | Where-Object { $_.id -eq $paymentId }
        $finalStatus = $updatedPayment.status
        
        $isConfirmed = $finalStatus -eq "confirmed"
        
        if ($isConfirmed) {
            Add-TestResult "Webhook approved -> confirmed" $true "Estado cambio: $initialStatus -> $finalStatus"
        } else {
            Add-TestResult "Webhook approved -> confirmed" $false "Estado no cambio correctamente: $initialStatus -> $finalStatus (esperado: confirmed)"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
        if ($errorDetails) {
            Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        }
        Add-TestResult "Webhook approved -> confirmed" $false "Error: $($_.Exception.Message)"
    }
}

# 4. Verificar que el balance de la venta se actualizó
Write-Host "`n4. Verificando balance de venta..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $balanceAmount = $saleResponse.financial.balanceAmount
        $paidAmount = $saleResponse.financial.paidAmount
        $isPaid = $saleResponse.financial.isPaid
        
        # Si el pago fue confirmado, el balance debería ser 0
        if ($isPaid -and $balanceAmount -eq 0) {
            Add-TestResult "Balance actualizado" $true "Venta pagada: paidAmount=$paidAmount, balanceAmount=$balanceAmount, isPaid=$isPaid"
        } else {
            Add-TestResult "Balance actualizado" $false "Balance no actualizado correctamente: paidAmount=$paidAmount, balanceAmount=$balanceAmount, isPaid=$isPaid"
        }
    } catch {
        Add-TestResult "Balance actualizado" $false "Error: $($_.Exception.Message)"
    }
}

# 5. Verificar que la venta cambió a estado paid
Write-Host "`n5. Verificando estado de venta..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $saleStatus = $saleResponse.status
        
        if ($saleStatus -eq "paid") {
            Add-TestResult "Venta cambio a paid" $true "Estado de venta: $saleStatus"
        } else {
            Add-TestResult "Venta cambio a paid" $false "Estado de venta: $saleStatus (esperado: paid)"
        }
    } catch {
        Add-TestResult "Venta cambio a paid" $false "Error: $($_.Exception.Message)"
    }
}

# 6. Simular webhook de pago rechazado (rejected → failed)
Write-Host "`n6. Simulando webhook de pago rechazado..." -ForegroundColor Yellow
if ($saleId) {
    try {
        # Crear otra venta y pago para probar rejected
        $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $product = $productsResponse.data[0]
        
        $saleBody2 = @{
            items = @(
                @{
                    productId = $product.id
                    quantity = 1
                    unitPrice = 2000
                }
            )
        } | ConvertTo-Json -Depth 10

        $saleResponse2 = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $saleBody2 `
            -ErrorAction Stop
        
        $saleId2 = $saleResponse2.id
        
        Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId2/confirm" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop | Out-Null
        
        $mpResponse2 = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId2/payments/mercadopago" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        $paymentId2 = $mpResponse2.id
        $preferenceId2 = $mpResponse2.payment_id
        
        # Simular webhook rejected
        $webhookBody2 = @{
            type = "payment"
            data = @{
                id = $preferenceId2
                status = "rejected"
                status_detail = "cc_rejected_insufficient_amount"
                transaction_amount = 2000
                external_reference = $saleId2
            }
        } | ConvertTo-Json -Depth 10

        Invoke-RestMethod -Uri "$BaseUrl/api/webhooks/mercadopago" `
            -Method POST `
            -ContentType "application/json" `
            -Body $webhookBody2 `
            -ErrorAction Stop | Out-Null
        
        Start-Sleep -Seconds 2
        
        $paymentAfter2 = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId2/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $updatedPayment2 = $paymentAfter2.payments | Where-Object { $_.id -eq $paymentId2 }
        $finalStatus2 = $updatedPayment2.status
        
        if ($finalStatus2 -eq "failed") {
            Add-TestResult "Webhook rejected -> failed" $true "Estado cambio a: $finalStatus2"
        } else {
            Add-TestResult "Webhook rejected -> failed" $false "Estado: $finalStatus2 (esperado: failed)"
        }
    } catch {
        Add-TestResult "Webhook rejected -> failed" $false "Error: $($_.Exception.Message)"
    }
}

# 7. Verificar idempotencia del webhook (enviar mismo webhook dos veces)
Write-Host "`n7. Verificando idempotencia del webhook..." -ForegroundColor Yellow
if ($paymentId -and $preferenceId) {
    try {
        # Obtener estado actual
        $paymentBefore = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $currentPayment = $paymentBefore.payments | Where-Object { $_.id -eq $paymentId }
        $statusBefore = $currentPayment.status
        
        # Enviar mismo webhook otra vez
        $webhookBody3 = @{
            type = "payment"
            data = @{
                id = $preferenceId
                status = "approved"
                transaction_amount = 3000
                external_reference = $saleId
            }
        } | ConvertTo-Json -Depth 10

        Invoke-RestMethod -Uri "$BaseUrl/api/webhooks/mercadopago" `
            -Method POST `
            -ContentType "application/json" `
            -Body $webhookBody3 `
            -ErrorAction Stop | Out-Null
        
        Start-Sleep -Seconds 1
        
        $paymentAfter = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $updatedPayment = $paymentAfter.payments | Where-Object { $_.id -eq $paymentId }
        $statusAfter = $updatedPayment.status
        
        # El estado no debería cambiar si ya está en confirmed
        if ($statusBefore -eq $statusAfter) {
            Add-TestResult "Idempotencia webhook" $true "Estado no cambio (idempotente): $statusBefore"
        } else {
            Add-TestResult "Idempotencia webhook" $false "Estado cambio: $statusBefore -> $statusAfter (no deberia cambiar)"
        }
    } catch {
        Add-TestResult "Idempotencia webhook" $false "Error: $($_.Exception.Message)"
    }
}

# 8. Verificar que se guardó el raw payload en gateway_metadata
Write-Host "`n8. Verificando raw payload en metadata..." -ForegroundColor Yellow
if ($paymentId) {
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $payment = $paymentResponse.payments | Where-Object { $_.id -eq $paymentId }
        
        if ($payment.gateway_metadata) {
            $metadata = $payment.gateway_metadata
            $hasLastWebhook = $metadata.last_webhook -ne $null
            $hasRawPayload = $metadata.last_webhook.raw_payload -ne $null
            
            if ($hasLastWebhook -and $hasRawPayload) {
                Add-TestResult "Raw payload guardado" $true "last_webhook y raw_payload presentes en metadata"
            } else {
                Add-TestResult "Raw payload guardado" $false "Faltan campos: last_webhook=$hasLastWebhook, raw_payload=$hasRawPayload"
            }
        } else {
            Add-TestResult "Raw payload guardado" $false "No hay gateway_metadata"
        }
    } catch {
        Add-TestResult "Raw payload guardado" $false "Error: $($_.Exception.Message)"
    }
}

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint E esta funcionando correctamente." -ForegroundColor Green
    Write-Host "`nEl sistema puede procesar webhooks y actualizar estados automaticamente." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

