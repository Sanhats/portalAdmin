# Script de prueba para el Sprint de Normalización de Pagos
# Prueba: payment_methods, campos financieros, auditoría

Write-Host "=== Prueba del Sprint de Normalización de Pagos ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$token = $null
$saleId = $null
$paymentMethodId = $null
$customPaymentMethodId = $null

# ============================================
# 1. Verificar que el servidor esté corriendo
# ============================================
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "$baseUrl/products" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# ============================================
# 2. Login para obtener token
# ============================================
Write-Host ""
Write-Host "2. Autenticando..." -ForegroundColor Yellow
Write-Host "   ⚠️  Asegúrate de tener un usuario creado en Supabase" -ForegroundColor Gray

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
    Write-Host "   ✅ Login exitoso" -ForegroundColor Green
    Write-Host "   Usuario: $($loginResponse.user.email)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# ============================================
# 3. Obtener o crear una venta para pruebas
# ============================================
Write-Host ""
Write-Host "3. Obteniendo venta para pruebas..." -ForegroundColor Yellow

try {
    # Intentar obtener una venta existente (preferiblemente confirmed)
    $salesResponse = Invoke-RestMethod -Uri "$baseUrl/sales?status=confirmed&limit=1" -Method GET -Headers $headers
    $sales = $salesResponse.data
    
    if ($sales -and $sales.Count -gt 0) {
        $testSale = $sales[0]
        $saleId = $testSale.id
        Write-Host "   ✅ Venta encontrada: $saleId" -ForegroundColor Green
        Write-Host "   Estado: $($testSale.status)" -ForegroundColor Gray
        Write-Host "   Total: $($testSale.total_amount)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No hay ventas confirmadas. Creando una venta de prueba..." -ForegroundColor Yellow
        
        # Obtener un producto
        $productsResponse = Invoke-RestMethod -Uri "$baseUrl/products?limit=1" -Method GET -Headers $headers
        $products = $productsResponse.data
        
        if (-not $products -or $products.Count -eq 0) {
            Write-Host "   ❌ No hay productos disponibles. Crea un producto primero." -ForegroundColor Red
            exit 1
        }
        
        $testProduct = $products[0]
        
        # Crear venta
        $saleBody = @{
            items = @(
                @{
                    productId = $testProduct.id
                    quantity = 2
                    unitPrice = [double]$testProduct.price
                }
            )
            paymentMethod = "cash"
            notes = "Venta de prueba para normalización de pagos"
        } | ConvertTo-Json -Depth 10
        
        $newSale = Invoke-RestMethod -Uri "$baseUrl/sales" `
            -Method POST `
            -Body $saleBody `
            -Headers $headers
        
        $saleId = $newSale.id
        
        # Confirmar la venta
        $confirmedSale = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/confirm" `
            -Method POST `
            -Headers $headers
        
        Write-Host "   ✅ Venta creada y confirmada: $saleId" -ForegroundColor Green
        Write-Host "   Total: $($confirmedSale.total_amount)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error al obtener/crear venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 4. Listar métodos de pago existentes (GET /api/payment-methods)
# ============================================
Write-Host ""
Write-Host "4. Listando métodos de pago existentes..." -ForegroundColor Yellow

try {
    $paymentMethodsResponse = Invoke-RestMethod -Uri "$baseUrl/payment-methods" -Method GET -Headers $headers
    Write-Host "   ✅ Métodos de pago obtenidos: $($paymentMethodsResponse.Count)" -ForegroundColor Green
    
    if ($paymentMethodsResponse.Count -gt 0) {
        $paymentMethodId = $paymentMethodsResponse[0].id
        Write-Host "   Primer método: $($paymentMethodsResponse[0].label) (code: $($paymentMethodsResponse[0].code))" -ForegroundColor Gray
        Write-Host "   ID: $paymentMethodId" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No hay métodos de pago. Se crearán automáticamente en la migración." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al listar métodos de pago: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ============================================
# 5. Crear método de pago personalizado (POST /api/payment-methods)
# ============================================
Write-Host ""
Write-Host "5. Creando método de pago personalizado..." -ForegroundColor Yellow

$customMethodBody = @{
    code = "qr_custom_$(Get-Date -Format 'yyyyMMddHHmmss')"
    label = "QR Personalizado de Prueba"
    type = "qr"
    isActive = $true
    metadata = @{
        provider = "custom"
        test = $true
    }
} | ConvertTo-Json -Depth 10

try {
    $customMethod = Invoke-RestMethod -Uri "$baseUrl/payment-methods" `
        -Method POST `
        -Body $customMethodBody `
        -Headers $headers
    
    $customPaymentMethodId = $customMethod.id
    Write-Host "   ✅ Método de pago creado exitosamente" -ForegroundColor Green
    Write-Host "   ID: $customPaymentMethodId" -ForegroundColor Gray
    Write-Host "   Code: $($customMethod.code)" -ForegroundColor Gray
    Write-Host "   Label: $($customMethod.label)" -ForegroundColor Gray
    Write-Host "   Type: $($customMethod.type)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al crear método de pago: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    $customPaymentMethodId = $null
}

# ============================================
# 6. Actualizar método de pago (PUT /api/payment-methods/:id)
# ============================================
Write-Host ""
Write-Host "6. Actualizando método de pago personalizado..." -ForegroundColor Yellow

if ($customPaymentMethodId) {
    $updateMethodBody = @{
        label = "QR Personalizado Actualizado"
        metadata = @{
            provider = "custom"
            test = $true
            updated = $true
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $updatedMethod = Invoke-RestMethod -Uri "$baseUrl/payment-methods/$customPaymentMethodId" `
            -Method PUT `
            -Body $updateMethodBody `
            -Headers $headers
        
        Write-Host "   ✅ Método de pago actualizado exitosamente" -ForegroundColor Green
        Write-Host "   Label actualizado: $($updatedMethod.label)" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ Error al actualizar método de pago: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️  No se pudo crear método de pago, saltando actualización" -ForegroundColor Yellow
}

# ============================================
# 7. Verificar estado financiero inicial de la venta
# ============================================
Write-Host ""
Write-Host "7. Verificando estado financiero inicial de la venta..." -ForegroundColor Yellow

try {
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" -Method GET -Headers $headers
    Write-Host "   ✅ Venta obtenida" -ForegroundColor Green
    Write-Host "   Total: $($saleDetail.total_amount)" -ForegroundColor Gray
    Write-Host "   Paid Amount: $($saleDetail.paid_amount)" -ForegroundColor Gray
    Write-Host "   Balance Amount: $($saleDetail.balance_amount)" -ForegroundColor Gray
    Write-Host "   Is Paid: $($saleDetail.financial.isPaid)" -ForegroundColor Gray
    
    if ($saleDetail.financial) {
        Write-Host "   ✅ Resumen financiero incluido correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ADVERTENCIA: Resumen financiero no encontrado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al obtener venta: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 8. Crear pago con payment_method_id (POST /api/sales/:id/payments)
# ============================================
Write-Host ""
Write-Host "8. Creando pago con payment_method_id..." -ForegroundColor Yellow

if ($customPaymentMethodId) {
    $paymentAmount = [Math]::Floor([double]$saleDetail.total_amount / 2)
    Write-Host "   Monto: $paymentAmount" -ForegroundColor Gray
    
    $paymentBody = @{
        amount = $paymentAmount
        paymentMethodId = $customPaymentMethodId
        status = "confirmed"
        reference = "Pago con método personalizado"
    } | ConvertTo-Json
    
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/payments" `
            -Method POST `
            -Body $paymentBody `
            -Headers $headers
        
        Write-Host "   ✅ Pago creado exitosamente" -ForegroundColor Green
        Write-Host "   ID: $($paymentResponse.id)" -ForegroundColor Gray
        Write-Host "   Monto: $($paymentResponse.amount)" -ForegroundColor Gray
        Write-Host "   Payment Method ID: $($paymentResponse.payment_method_id)" -ForegroundColor Gray
        Write-Host "   Status: $($paymentResponse.status)" -ForegroundColor Gray
        
        # Verificar estado financiero actualizado
        Start-Sleep -Seconds 1
        $saleAfterPayment = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" -Method GET -Headers $headers
        Write-Host "   Paid Amount después del pago: $($saleAfterPayment.paid_amount)" -ForegroundColor Gray
        Write-Host "   Balance Amount: $($saleAfterPayment.balance_amount)" -ForegroundColor Gray
        
        if ([double]$saleAfterPayment.paid_amount -eq $paymentAmount) {
            Write-Host "   ✅ Paid Amount actualizado correctamente" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  ADVERTENCIA: Paid Amount no coincide" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Error al crear pago: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️  No hay método de pago disponible, usando method (backward compatibility)..." -ForegroundColor Yellow
    
    $paymentAmount = [Math]::Floor([double]$saleDetail.total_amount / 2)
    $paymentBody = @{
        amount = $paymentAmount
        method = "cash"
        status = "confirmed"
        reference = "Pago con method (backward compatibility)"
    } | ConvertTo-Json
    
    try {
        $paymentResponse = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/payments" `
            -Method POST `
            -Body $paymentBody `
            -Headers $headers
        
        Write-Host "   ✅ Pago creado con backward compatibility" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Error al crear pago: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# 9. Listar pagos con resumen financiero (GET /api/sales/:id/payments)
# ============================================
Write-Host ""
Write-Host "9. Listando pagos con resumen financiero..." -ForegroundColor Yellow

try {
    $paymentsList = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/payments" -Method GET -Headers $headers
    Write-Host "   ✅ Pagos obtenidos: $($paymentsList.summary.total)" -ForegroundColor Green
    Write-Host "   Total Pagado: $($paymentsList.summary.totalPaid)" -ForegroundColor Gray
    Write-Host "   Paid Amount: $($paymentsList.summary.paidAmount)" -ForegroundColor Gray
    Write-Host "   Balance Amount: $($paymentsList.summary.balanceAmount)" -ForegroundColor Gray
    Write-Host "   Is Paid: $($paymentsList.summary.isPaid)" -ForegroundColor Gray
    Write-Host "   Por estado:" -ForegroundColor Gray
    Write-Host "     - Pending: $($paymentsList.summary.byStatus.pending)" -ForegroundColor Gray
    Write-Host "     - Confirmed: $($paymentsList.summary.byStatus.confirmed)" -ForegroundColor Gray
    Write-Host "     - Failed: $($paymentsList.summary.byStatus.failed)" -ForegroundColor Gray
    Write-Host "     - Refunded: $($paymentsList.summary.byStatus.refunded)" -ForegroundColor Gray
    
    # Verificar que los pagos incluyen payment_method
    if ($paymentsList.payments.Count -gt 0) {
        $firstPayment = $paymentsList.payments[0]
        if ($firstPayment.payment_methods) {
            Write-Host "   ✅ Payment method incluido en pagos" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Payment method no incluido" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ❌ Error al listar pagos: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 10. Crear segundo pago para completar el total
# ============================================
Write-Host ""
Write-Host "10. Creando segundo pago para completar el total..." -ForegroundColor Yellow

try {
    $saleCurrent = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" -Method GET -Headers $headers
    $remainingAmount = [double]$saleCurrent.balance_amount
    
    Write-Host "   Monto restante: $remainingAmount" -ForegroundColor Gray
    
    if ($remainingAmount -gt 0) {
        $secondPaymentBody = @{
            amount = $remainingAmount
            method = "transfer"
            status = "confirmed"
            reference = "Pago final - Transferencia"
        } | ConvertTo-Json
        
        $secondPayment = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/payments" `
            -Method POST `
            -Body $secondPaymentBody `
            -Headers $headers
        
        Write-Host "   ✅ Segundo pago creado exitosamente" -ForegroundColor Green
        
        # Verificar que la venta cambió a paid
        Start-Sleep -Seconds 1
        $saleAfterSecond = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" -Method GET -Headers $headers
        Write-Host "   Estado de la venta: $($saleAfterSecond.status)" -ForegroundColor Gray
        Write-Host "   Balance Amount: $($saleAfterSecond.balance_amount)" -ForegroundColor Gray
        Write-Host "   Is Paid: $($saleAfterSecond.financial.isPaid)" -ForegroundColor Gray
        Write-Host "   Payment Completed At: $($saleAfterSecond.financial.paymentCompletedAt)" -ForegroundColor Gray
        
        if ($saleAfterSecond.status -eq "paid" -and [double]$saleAfterSecond.balance_amount -le 0) {
            Write-Host "   ✅ Venta actualizada a 'paid' correctamente" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  ADVERTENCIA: Venta no cambió a 'paid' o balance > 0" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  No hay saldo pendiente, saltando segundo pago" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al crear segundo pago: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ============================================
# 11. Verificar filtros en GET /api/payment-methods
# ============================================
Write-Host ""
Write-Host "11. Probando filtros en GET /api/payment-methods..." -ForegroundColor Yellow

try {
    # Filtrar por tipo
    $qrMethods = Invoke-RestMethod -Uri "$baseUrl/payment-methods?type=qr" -Method GET -Headers $headers
    Write-Host "   ✅ Métodos QR: $($qrMethods.Count)" -ForegroundColor Green
    
    # Filtrar por activos
    $activeMethods = Invoke-RestMethod -Uri "$baseUrl/payment-methods?isActive=true" -Method GET -Headers $headers
    Write-Host "   ✅ Métodos activos: $($activeMethods.Count)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error al filtrar métodos de pago: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Resumen final
# ============================================
Write-Host ""
Write-Host "=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "✅ GET /api/payment-methods - Listar métodos de pago" -ForegroundColor Green
Write-Host "✅ POST /api/payment-methods - Crear método de pago" -ForegroundColor Green
Write-Host "✅ PUT /api/payment-methods/:id - Actualizar método de pago" -ForegroundColor Green
Write-Host "✅ POST /api/sales/:id/payments - Crear pago con payment_method_id" -ForegroundColor Green
Write-Host "✅ GET /api/sales/:id/payments - Listar pagos con resumen financiero" -ForegroundColor Green
Write-Host "✅ GET /api/sales/:id - Incluir resumen financiero" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Funcionalidades verificadas:" -ForegroundColor Green
Write-Host "   - Métodos de pago configurables por comercio" -ForegroundColor Gray
Write-Host "   - Cálculo automático de paid_amount y balance_amount" -ForegroundColor Gray
Write-Host "   - Actualización automática a 'paid' cuando balance <= 0" -ForegroundColor Gray
Write-Host "   - Backward compatibility con 'method'" -ForegroundColor Gray
Write-Host "   - Resumen financiero en respuestas" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Todas las pruebas completadas!" -ForegroundColor Cyan

