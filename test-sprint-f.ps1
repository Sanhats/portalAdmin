# Script de Pruebas - SPRINT F: QR / POS
# Verifica que los pagos QR y la confirmación manual funcionen correctamente

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

Write-Host "`n=== Pruebas SPRINT F - QR / POS ===" -ForegroundColor Cyan
Write-Host "Verificando pagos QR y confirmacion manual`n" -ForegroundColor Yellow

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

# 2. Crear venta confirmada
Write-Host "`n2. Creando venta confirmada..." -ForegroundColor Yellow
$saleId = $null
try {
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($productsResponse.data -and $productsResponse.data.Count -gt 0) {
        $product = $productsResponse.data[0]
        
        # Usar el mismo formato que test-sprint-a.ps1 que funciona
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
        
        Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop | Out-Null
        
        Add-TestResult "Crear venta confirmada" $true "Venta ID: $saleId"
    } else {
        Add-TestResult "Crear venta confirmada" $false "No hay productos disponibles"
        exit 1
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.ErrorDetails.Message
    $errorMessage = $_.Exception.Message
    
    Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
    Write-Host "  Mensaje: $errorMessage" -ForegroundColor Yellow
    if ($errorDetails) {
        Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        try {
            $errorObj = $errorDetails | ConvertFrom-Json
            Write-Host "  Error parseado: $($errorObj | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
        } catch {
            Write-Host "  No se pudo parsear error como JSON" -ForegroundColor Yellow
        }
    }
    Add-TestResult "Crear venta confirmada" $false "Error HTTP $statusCode : $errorMessage"
    exit 1
}

# 3. Crear pago QR dinámico
Write-Host "`n3. Creando pago QR dinámico..." -ForegroundColor Yellow
$qrPaymentId = $null
if ($saleId) {
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
        
        $qrPaymentId = $qrResponse.id
        $qrCode = $qrResponse.qrCode
        $qrStatus = $qrResponse.status
        
        if ($qrCode -and $qrStatus -eq "pending") {
            Add-TestResult "Crear pago QR dinamico" $true "Pago ID: $qrPaymentId, QR Code: $qrCode, Status: $qrStatus"
        } else {
            Add-TestResult "Crear pago QR dinamico" $false "QR Code o status incorrecto: qrCode=$qrCode, status=$qrStatus"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
        if ($errorDetails) {
            Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        }
        Add-TestResult "Crear pago QR dinamico" $false "Error: $($_.Exception.Message)"
    }
}

# 4. Verificar que el pago está en estado pending
Write-Host "`n4. Verificando estado del pago QR..." -ForegroundColor Yellow
if ($qrPaymentId) {
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $qrPayment = $paymentResponse.payments | Where-Object { $_.id -eq $qrPaymentId }
        
        if ($qrPayment.status -eq "pending") {
            Add-TestResult "Estado pending" $true "Pago en estado: $($qrPayment.status)"
        } else {
            Add-TestResult "Estado pending" $false "Estado incorrecto: $($qrPayment.status) (esperado: pending)"
        }
    } catch {
        Add-TestResult "Estado pending" $false "Error: $($_.Exception.Message)"
    }
}

# 5. Confirmar pago manualmente con evidencia
Write-Host "`n5. Confirmando pago manualmente..." -ForegroundColor Yellow
if ($qrPaymentId) {
    try {
        $confirmBody = @{
            proofType = "qr_code"
            proofReference = "QR-123456789"
            proofFileUrl = "https://example.com/qr-proof.jpg"
            terminalId = "TERMINAL-001"
            cashRegisterId = "CAJA-001"
        } | ConvertTo-Json

        $confirmResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payments/$qrPaymentId/confirm" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $confirmBody `
            -ErrorAction Stop
        
        $confirmedStatus = $confirmResponse.status
        $proofType = $confirmResponse.proof_type
        $proofReference = $confirmResponse.proof_reference
        $terminalId = $confirmResponse.terminal_id
        
        if ($confirmedStatus -eq "confirmed" -and $proofType -eq "qr_code") {
            Add-TestResult "Confirmar pago manual" $true "Status: $confirmedStatus, Proof: $proofType, Terminal: $terminalId"
        } else {
            Add-TestResult "Confirmar pago manual" $false "Status: $confirmedStatus, Proof: $proofType (esperado: confirmed, qr_code)"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorDetails = $_.ErrorDetails.Message
        Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
        if ($errorDetails) {
            Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        }
        Add-TestResult "Confirmar pago manual" $false "Error: $($_.Exception.Message)"
    }
}

# 6. Verificar que el balance se actualizó
Write-Host "`n6. Verificando balance de venta..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $balanceAmount = $saleResponse.financial.balanceAmount
        $paidAmount = $saleResponse.financial.paidAmount
        $isPaid = $saleResponse.financial.isPaid
        
        if ($isPaid -and $balanceAmount -eq 0) {
            Add-TestResult "Balance actualizado" $true "Venta pagada: paidAmount=$paidAmount, balanceAmount=$balanceAmount"
        } else {
            Add-TestResult "Balance actualizado" $false "Balance: paidAmount=$paidAmount, balanceAmount=$balanceAmount, isPaid=$isPaid"
        }
    } catch {
        Add-TestResult "Balance actualizado" $false "Error: $($_.Exception.Message)"
    }
}

# 7. Crear pago QR estático
Write-Host "`n7. Creando pago QR estático..." -ForegroundColor Yellow
if ($saleId) {
    try {
        # Crear otra venta para el QR estático
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
                    unitPrice = "1500"
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
        
        $qrStaticBody = @{
            qrType = "static"
            qrData = "ALIAS:MIEMPRESA.CBU:1234567890123456789012"
        } | ConvertTo-Json

        $qrStaticResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId2/payments/qr" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $qrStaticBody `
            -ErrorAction Stop
        
        $qrStaticCode = $qrStaticResponse.qrCode
        $qrStaticType = $qrStaticResponse.qrType
        
        if ($qrStaticCode -and $qrStaticType -eq "static") {
            Add-TestResult "Crear pago QR estatico" $true "QR Code: $qrStaticCode, Type: $qrStaticType"
        } else {
            Add-TestResult "Crear pago QR estatico" $false "QR Code o type incorrecto: qrCode=$qrStaticCode, type=$qrStaticType"
        }
    } catch {
        Add-TestResult "Crear pago QR estatico" $false "Error: $($_.Exception.Message)"
    }
}

# 8. Verificar idempotencia del QR
Write-Host "`n8. Verificando idempotencia del QR..." -ForegroundColor Yellow
try {
    # Crear una nueva venta para probar idempotencia (la anterior ya está pagada)
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    $product = $productsResponse.data[0]
    
    $saleBody3 = @{
        items = @(
            @{
                productId = $product.id
                quantity = 1
                unitPrice = 1000
            }
        )
    } | ConvertTo-Json -Depth 10

    $saleResponse3 = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $saleBody3 `
        -ErrorAction Stop
    
    $saleId3 = $saleResponse3.id
    
    Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId3/confirm" `
        -Method POST `
        -Headers $headers `
        -ErrorAction Stop | Out-Null
    
    # Intentar crear el mismo pago QR dos veces
    $qrBody2 = @{
        qrType = "dynamic"
    } | ConvertTo-Json

    $qrResponse1 = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId3/payments/qr" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $qrBody2 `
        -ErrorAction Stop
    
    $qrResponse2 = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId3/payments/qr" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $qrBody2 `
        -ErrorAction Stop
    
    if ($qrResponse1.id -eq $qrResponse2.id) {
        Add-TestResult "Idempotencia QR" $true "Mismo pago retornado (ID: $($qrResponse1.id))"
    } else {
        Add-TestResult "Idempotencia QR" $false "Pagos diferentes: $($qrResponse1.id) vs $($qrResponse2.id)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.ErrorDetails.Message
    Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
    if ($errorDetails) {
        Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
    }
    Add-TestResult "Idempotencia QR" $false "Error: $($_.Exception.Message)"
}

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint F esta funcionando correctamente." -ForegroundColor Green
    Write-Host "`nEl sistema puede crear pagos QR y confirmarlos manualmente." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

