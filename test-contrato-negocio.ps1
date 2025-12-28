# Script de Verificación del Contrato de Negocio
# Verifica que todas las reglas del contrato estén implementadas correctamente

Write-Host "=== Verificación del Contrato de Negocio ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$token = $null
$testResults = @()

function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    $script:testResults += @{
        Test = $TestName
        Passed = $Passed
        Message = $Message
    }
    $color = if ($Passed) { "Green" } else { "Red" }
    $symbol = if ($Passed) { "✅" } else { "❌" }
    Write-Host "  $symbol $TestName" -ForegroundColor $color
    if ($Message) {
        Write-Host "     $Message" -ForegroundColor Gray
    }
}

# ============================================
# 1. Verificar servidor
# ============================================
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "$baseUrl/products" -Method GET -ErrorAction Stop
    Add-TestResult "Servidor funcionando" $true
} catch {
    Add-TestResult "Servidor funcionando" $false "Servidor no disponible"
    Write-Host "   ❌ Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# ============================================
# 2. Login
# ============================================
Write-Host ""
Write-Host "2. Autenticando..." -ForegroundColor Yellow
$email = Read-Host "   Email"
$password = Read-Host "   Password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    $loginBody = @{
        email = $email
        password = $plainPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    $token = $loginResponse.session.access_token
    Add-TestResult "Login exitoso" $true
} catch {
    Add-TestResult "Login exitoso" $false $_.Exception.Message
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# ============================================
# 3. CONTRATO: Estados de Venta
# ============================================
Write-Host ""
Write-Host "3. Verificando Contrato de Estados de Venta..." -ForegroundColor Yellow

# 3.1. Crear venta en draft
Write-Host "   3.1. Creando venta en draft..." -ForegroundColor Gray
try {
    $productsResponse = Invoke-RestMethod -Uri "$baseUrl/products?limit=1" -Method GET -Headers $headers
    $testProduct = $productsResponse.data[0]
    
    $saleBody = @{
        items = @(
            @{
                productId = $testProduct.id
                quantity = 1
                unitPrice = [double]$testProduct.price
            }
        )
        notes = "Venta de prueba para contrato"
    } | ConvertTo-Json -Depth 10
    
    $draftSale = Invoke-RestMethod -Uri "$baseUrl/sales" `
        -Method POST `
        -Body $saleBody `
        -Headers $headers
    
    $draftSaleId = $draftSale.id
    Add-TestResult "Venta draft creada" ($draftSale.status -eq "draft") "ID: $draftSaleId"
} catch {
    Add-TestResult "Venta draft creada" $false $_.Exception.Message
    exit 1
}

# 3.2. CONTRATO: draft no admite pagos
Write-Host "   3.2. Verificando que draft NO admite pagos..." -ForegroundColor Gray
try {
    $paymentBody = @{
        amount = 1000
        method = "cash"
        status = "pending"
    } | ConvertTo-Json
    
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/sales/$draftSaleId/payments" `
            -Method POST `
            -Body $paymentBody `
            -Headers $headers `
            -ErrorAction Stop
        Add-TestResult "draft rechaza pagos" $false "Debería haber rechazado el pago"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = ""
        try {
            if ($null -ne $_.ErrorDetails.Message) {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                $errorMessage = $errorDetails.error
            } else {
                $errorMessage = $_.Exception.Message
            }
        } catch {
            $errorMessage = $_.Exception.Message
        }
        
        # 400 es el código esperado (Bad Request) - significa que la validación funcionó
        if ($statusCode -eq 400 -or $errorMessage -like "*draft*" -or $errorMessage -like "*No se pueden registrar pagos*" -or $errorMessage -like "*Confirma la venta*") {
            Add-TestResult "draft rechaza pagos" $true "Error esperado (HTTP $statusCode): $errorMessage"
        } else {
            Add-TestResult "draft rechaza pagos" $false "Error inesperado (HTTP $statusCode): $errorMessage"
        }
    }
} catch {
    Add-TestResult "draft rechaza pagos" $false $_.Exception.Message
}

# 3.3. CONTRATO: draft es editable
Write-Host "   3.3. Verificando que draft es editable..." -ForegroundColor Gray
try {
    $updateBody = @{
        notes = "Notas actualizadas"
    } | ConvertTo-Json
    
    $updatedSale = Invoke-RestMethod -Uri "$baseUrl/sales/$draftSaleId" `
        -Method PUT `
        -Body $updateBody `
        -Headers $headers
    
    Add-TestResult "draft es editable" ($updatedSale.notes -eq "Notas actualizadas") "Notas actualizadas correctamente"
} catch {
    Add-TestResult "draft es editable" $false $_.Exception.Message
}

# 3.4. Confirmar venta
Write-Host "   3.4. Confirmando venta..." -ForegroundColor Gray
try {
    $confirmedSale = Invoke-RestMethod -Uri "$baseUrl/sales/$draftSaleId/confirm" `
        -Method POST `
        -Headers $headers
    
    Add-TestResult "Venta confirmada" ($confirmedSale.status -eq "confirmed") "Estado: $($confirmedSale.status)"
    $confirmedSaleId = $confirmedSale.id
} catch {
    Add-TestResult "Venta confirmada" $false $_.Exception.Message
    exit 1
}

# 3.5. CONTRATO: confirmed NO es editable
Write-Host "   3.5. Verificando que confirmed NO es editable..." -ForegroundColor Gray
try {
    $updateBody = @{
        notes = "Intento de editar confirmed"
    } | ConvertTo-Json
    
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" `
            -Method PUT `
            -Body $updateBody `
            -Headers $headers `
            -ErrorAction Stop
        Add-TestResult "confirmed NO es editable" $false "Debería haber rechazado la edición"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = ""
        try {
            if ($null -ne $_.ErrorDetails.Message) {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                $errorMessage = $errorDetails.error
            } else {
                $errorMessage = $_.Exception.Message
            }
        } catch {
            $errorMessage = $_.Exception.Message
        }
        
        # 400 es el código esperado (Bad Request) - significa que la validación funcionó
        if ($statusCode -eq 400 -or $errorMessage -like "*draft*" -or $errorMessage -like "*Solo se pueden editar*") {
            Add-TestResult "confirmed NO es editable" $true "Error esperado (HTTP $statusCode): $errorMessage"
        } else {
            Add-TestResult "confirmed NO es editable" $false "Error inesperado (HTTP $statusCode): $errorMessage"
        }
    }
} catch {
    Add-TestResult "confirmed NO es editable" $false $_.Exception.Message
}

# 3.6. CONTRATO: confirmed admite pagos
Write-Host "   3.6. Verificando que confirmed admite pagos..." -ForegroundColor Gray
try {
    $totalAmount = [double]$confirmedSale.total_amount
    $paymentAmount = [Math]::Floor($totalAmount / 2)
    
    $paymentBody = @{
        amount = $paymentAmount
        method = "cash"
        status = "pending"
    } | ConvertTo-Json
    
    $payment1 = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/payments" `
        -Method POST `
        -Body $paymentBody `
        -Headers $headers
    
    Add-TestResult "confirmed admite pagos" ($null -ne $payment1.id) "Pago creado: $($payment1.id)"
    $pendingPaymentId = $payment1.id
} catch {
    Add-TestResult "confirmed admite pagos" $false $_.Exception.Message
}

# ============================================
# 4. CONTRATO: Estados de Pago
# ============================================
Write-Host ""
Write-Host "4. Verificando Contrato de Estados de Pago..." -ForegroundColor Yellow

# 4.1. CONTRATO: pending puede eliminarse
Write-Host "   4.1. Verificando que pending puede eliminarse..." -ForegroundColor Gray
try {
    $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/payments/$pendingPaymentId" `
        -Method DELETE `
        -Headers $headers
    
    Add-TestResult "pending puede eliminarse" ($null -ne $deleteResponse.deletedPayment) "Pago eliminado correctamente"
} catch {
    Add-TestResult "pending puede eliminarse" $false $_.Exception.Message
}

# 4.2. Crear pago confirmed
Write-Host "   4.2. Creando pago confirmed..." -ForegroundColor Gray
try {
    $totalAmount = [double]$confirmedSale.total_amount
    $paymentAmount = [Math]::Floor($totalAmount / 2)
    
    $paymentBody = @{
        amount = $paymentAmount
        method = "cash"
        status = "confirmed"
    } | ConvertTo-Json
    
    $confirmedPayment = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/payments" `
        -Method POST `
        -Body $paymentBody `
        -Headers $headers
    
    Add-TestResult "Pago confirmed creado" ($confirmedPayment.status -eq "confirmed") "ID: $($confirmedPayment.id)"
    $confirmedPaymentId = $confirmedPayment.id
} catch {
    Add-TestResult "Pago confirmed creado" $false $_.Exception.Message
    exit 1
}

# 4.3. CONTRATO: confirmed NO puede eliminarse
Write-Host "   4.3. Verificando que confirmed NO puede eliminarse..." -ForegroundColor Gray
try {
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/payments/$confirmedPaymentId" `
            -Method DELETE `
            -Headers $headers `
            -ErrorAction Stop
        Add-TestResult "confirmed NO puede eliminarse" $false "Debería haber rechazado la eliminación"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = ""
        try {
            if ($null -ne $_.ErrorDetails.Message) {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                $errorMessage = $errorDetails.error
            } else {
                $errorMessage = $_.Exception.Message
            }
        } catch {
            $errorMessage = $_.Exception.Message
        }
        
        # 400 es el código esperado (Bad Request) - significa que la validación funcionó
        if ($statusCode -eq 400 -or $errorMessage -like "*pending*" -or $errorMessage -like "*No se puede eliminar*" -or $errorMessage -like "*confirmado*") {
            Add-TestResult "confirmed NO puede eliminarse" $true "Error esperado (HTTP $statusCode): $errorMessage"
        } else {
            Add-TestResult "confirmed NO puede eliminarse" $false "Error inesperado (HTTP $statusCode): $errorMessage"
        }
    }
} catch {
    Add-TestResult "confirmed NO puede eliminarse" $false $_.Exception.Message
}

# ============================================
# 5. CONTRATO: Cálculo Financiero
# ============================================
Write-Host ""
Write-Host "5. Verificando Contrato de Cálculo Financiero..." -ForegroundColor Yellow

# 5.1. Verificar paid_amount solo cuenta confirmed
Write-Host "   5.1. Verificando que paid_amount solo cuenta confirmed..." -ForegroundColor Gray
try {
    # Crear pago pending (no debe contar)
    $pendingPaymentBody = @{
        amount = 1000
        method = "cash"
        status = "pending"
    } | ConvertTo-Json
    
    $pendingPayment = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/payments" `
        -Method POST `
        -Body $pendingPaymentBody `
        -Headers $headers
    
    Start-Sleep -Seconds 1
    
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" -Method GET -Headers $headers
    $paidAmount = [double]$saleDetail.paid_amount
    $confirmedAmount = [double]$confirmedPayment.amount
    
    # paid_amount debe ser igual al monto del pago confirmed (no incluir pending)
    $expectedPaid = $confirmedAmount
    $testPassed = [Math]::Abs($paidAmount - $expectedPaid) -lt 0.01
    
    Add-TestResult "paid_amount solo cuenta confirmed" $testPassed "paid_amount=$paidAmount, expected=$expectedPaid (pending no cuenta)"
} catch {
    Add-TestResult "paid_amount solo cuenta confirmed" $false $_.Exception.Message
}

# 5.2. Verificar balance_amount = total_amount - paid_amount
Write-Host "   5.2. Verificando balance_amount = total_amount - paid_amount..." -ForegroundColor Gray
try {
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" -Method GET -Headers $headers
    $totalAmount = [double]$saleDetail.total_amount
    $paidAmount = [double]$saleDetail.paid_amount
    $balanceAmount = [double]$saleDetail.balance_amount
    $expectedBalance = $totalAmount - $paidAmount
    
    $testPassed = [Math]::Abs($balanceAmount - $expectedBalance) -lt 0.01
    
    Add-TestResult "balance_amount calculado correctamente" $testPassed "balance=$balanceAmount, expected=$expectedBalance"
} catch {
    Add-TestResult "balance_amount calculado correctamente" $false $_.Exception.Message
}

# 5.3. Completar pago y verificar estado automático a paid
Write-Host "   5.3. Completando pago y verificando estado automático a paid..." -ForegroundColor Gray
try {
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" -Method GET -Headers $headers
    $remainingAmount = [double]$saleDetail.balance_amount
    
    if ($remainingAmount -gt 0) {
        $finalPaymentBody = @{
            amount = $remainingAmount
            method = "transfer"
            status = "confirmed"
        } | ConvertTo-Json
        
        $finalPayment = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/payments" `
            -Method POST `
            -Body $finalPaymentBody `
            -Headers $headers
        
        Start-Sleep -Seconds 1
        
        $paidSale = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" -Method GET -Headers $headers
        $testPassed = $paidSale.status -eq "paid" -and [double]$paidSale.balance_amount -le 0
        
        Add-TestResult "Estado automático a paid" $testPassed "Estado: $($paidSale.status), balance: $($paidSale.balance_amount)"
    } else {
        Add-TestResult "Estado automático a paid" $true "Ya estaba pagada"
    }
} catch {
    Add-TestResult "Estado automático a paid" $false $_.Exception.Message
}

# 5.4. CONTRATO: paid NO admite más pagos
Write-Host "   5.4. Verificando que paid NO admite más pagos..." -ForegroundColor Gray
try {
    $paymentBody = @{
        amount = 100
        method = "cash"
        status = "pending"
    } | ConvertTo-Json
    
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/payments" `
            -Method POST `
            -Body $paymentBody `
            -Headers $headers `
            -ErrorAction Stop
        Add-TestResult "paid NO admite más pagos" $false "Debería haber rechazado el pago"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = ""
        try {
            if ($null -ne $_.ErrorDetails.Message) {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                $errorMessage = $errorDetails.error
            } else {
                $errorMessage = $_.Exception.Message
            }
        } catch {
            $errorMessage = $_.Exception.Message
        }
        
        # 400 es el código esperado (Bad Request) - significa que la validación funcionó
        if ($statusCode -eq 400 -or $errorMessage -like "*pagada*" -or $errorMessage -like "*completamente pagada*") {
            Add-TestResult "paid NO admite más pagos" $true "Error esperado (HTTP $statusCode): $errorMessage"
        } else {
            Add-TestResult "paid NO admite más pagos" $false "Error inesperado (HTTP $statusCode): $errorMessage"
        }
    }
} catch {
    Add-TestResult "paid NO admite más pagos" $false $_.Exception.Message
}

# 5.5. CONTRATO: paid NO es cancelable
Write-Host "   5.5. Verificando que paid NO es cancelable..." -ForegroundColor Gray
try {
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId/cancel" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        Add-TestResult "paid NO es cancelable" $false "Debería haber rechazado la cancelación"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = ""
        try {
            if ($null -ne $_.ErrorDetails.Message) {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
                $errorMessage = $errorDetails.error
            } else {
                $errorMessage = $_.Exception.Message
            }
        } catch {
            $errorMessage = $_.Exception.Message
        }
        
        # 400 es el código esperado (Bad Request) - significa que la validación funcionó
        if ($statusCode -eq 400 -or $errorMessage -like "*pagada*" -or $errorMessage -like "*reembolso*") {
            Add-TestResult "paid NO es cancelable" $true "Error esperado (HTTP $statusCode): $errorMessage"
        } else {
            Add-TestResult "paid NO es cancelable" $false "Error inesperado (HTTP $statusCode): $errorMessage"
        }
    }
} catch {
    Add-TestResult "paid NO es cancelable" $false $_.Exception.Message
}

# ============================================
# 6. CONTRATO: Métodos de Pago
# ============================================
Write-Host ""
Write-Host "6. Verificando Contrato de Métodos de Pago..." -ForegroundColor Yellow

# 6.1. Crear método de pago personalizado
Write-Host "   6.1. Creando método de pago personalizado..." -ForegroundColor Gray
try {
    $methodBody = @{
        code = "test_gateway_$(Get-Date -Format 'yyyyMMddHHmmss')"
        label = "Gateway de Prueba"
        type = "gateway"
        isActive = $true
        metadata = @{
            provider = "test"
        }
    } | ConvertTo-Json -Depth 10
    
    $customMethod = Invoke-RestMethod -Uri "$baseUrl/payment-methods" `
        -Method POST `
        -Body $methodBody `
        -Headers $headers
    
    Add-TestResult "Método de pago creado" ($null -ne $customMethod.id) "ID: $($customMethod.id), type: $($customMethod.type)"
    $customMethodId = $customMethod.id
} catch {
    Add-TestResult "Método de pago creado" $false $_.Exception.Message
}

# 6.2. Crear pago con payment_method_id
Write-Host "   6.2. Creando pago con payment_method_id..." -ForegroundColor Gray
try {
    # Crear nueva venta para probar
    $newSaleBody = @{
        items = @(
            @{
                productId = $testProduct.id
                quantity = 1
                unitPrice = [double]$testProduct.price
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $newSale = Invoke-RestMethod -Uri "$baseUrl/sales" `
        -Method POST `
        -Body $newSaleBody `
        -Headers $headers
    
    $confirmedNewSale = Invoke-RestMethod -Uri "$baseUrl/sales/$($newSale.id)/confirm" `
        -Method POST `
        -Headers $headers
    
    $paymentBody = @{
        amount = [double]$confirmedNewSale.total_amount
        paymentMethodId = $customMethodId
        status = "confirmed"
    } | ConvertTo-Json
    
    $paymentWithMethod = Invoke-RestMethod -Uri "$baseUrl/sales/$($newSale.id)/payments" `
        -Method POST `
        -Body $paymentBody `
        -Headers $headers
    
    Add-TestResult "Pago con payment_method_id" ($paymentWithMethod.payment_method_id -eq $customMethodId) "payment_method_id: $($paymentWithMethod.payment_method_id)"
} catch {
    Add-TestResult "Pago con payment_method_id" $false $_.Exception.Message
}

# ============================================
# 7. CONTRATO: Resumen Financiero
# ============================================
Write-Host ""
Write-Host "7. Verificando Resumen Financiero..." -ForegroundColor Yellow

try {
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$confirmedSaleId" -Method GET -Headers $headers
    
    $hasFinancial = $null -ne $saleDetail.financial
    $hasTotalAmount = $null -ne $saleDetail.financial.totalAmount
    $hasPaidAmount = $null -ne $saleDetail.financial.paidAmount
    $hasBalanceAmount = $null -ne $saleDetail.financial.balanceAmount
    $hasIsPaid = $null -ne $saleDetail.financial.isPaid
    
    $testPassed = $hasFinancial -and $hasTotalAmount -and $hasPaidAmount -and $hasBalanceAmount -and $hasIsPaid
    
    Add-TestResult "Resumen financiero incluido" $testPassed "totalAmount, paidAmount, balanceAmount, isPaid presentes"
} catch {
    Add-TestResult "Resumen financiero incluido" $false $_.Exception.Message
}

# ============================================
# Resumen Final
# ============================================
Write-Host ""
Write-Host "=== Resumen de Verificación ===" -ForegroundColor Cyan
Write-Host ""

$totalTests = $script:testResults.Count
$passedTests = ($script:testResults | Where-Object { $_.Passed -eq $true }).Count
$failedTests = $totalTests - $passedTests

Write-Host "Total de pruebas: $totalTests" -ForegroundColor White
Write-Host "✅ Pasadas: $passedTests" -ForegroundColor Green
Write-Host "❌ Fallidas: $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema cumple con el contrato de negocio." -ForegroundColor Green
} else {
    Write-Host "⚠️  Algunas pruebas fallaron. Revisa los detalles arriba." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pruebas fallidas:" -ForegroundColor Red
    $script:testResults | Where-Object { $_.Passed -eq $false } | ForEach-Object {
        Write-Host "  ❌ $($_.Test)" -ForegroundColor Red
        if ($_.Message) {
            Write-Host "     $($_.Message)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "=== Fin de Verificación ===" -ForegroundColor Cyan

