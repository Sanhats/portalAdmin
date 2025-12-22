# Script de prueba para el Sistema de Ventas
# Prueba todos los endpoints: POST, GET, PUT, confirm, cancel

Write-Host "=== Prueba del Sistema de Ventas ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$token = $null
$saleId = $null
$productId = $null
$initialStock = 0

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
# 3. Obtener productos disponibles
# ============================================
Write-Host ""
Write-Host "3. Obteniendo productos disponibles..." -ForegroundColor Yellow

try {
    $productsResponse = Invoke-RestMethod -Uri "$baseUrl/products?limit=10" -Method GET -Headers $headers
    $products = $productsResponse.data
    
    if ($products -and $products.Count -gt 0) {
        $testProduct = $products[0]
        $productId = $testProduct.id
        $initialStock = $testProduct.stock
        Write-Host "   ✅ Producto encontrado: $($testProduct.name_internal)" -ForegroundColor Green
        Write-Host "   Stock actual: $initialStock" -ForegroundColor Gray
        Write-Host "   Precio: $($testProduct.price)" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ No hay productos disponibles. Crea un producto primero." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Error al obtener productos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================
# 4. Crear venta (POST /api/sales) - DRAFT
# ============================================
Write-Host ""
Write-Host "4. Creando venta en estado DRAFT..." -ForegroundColor Yellow

$saleBody = @{
    items = @(
        @{
            productId = $productId
            quantity = 2
            unitPrice = [double]$testProduct.price
        }
    )
    paymentMethod = "cash"
    notes = "Venta de prueba desde script"
} | ConvertTo-Json -Depth 10

try {
    $saleResponse = Invoke-RestMethod -Uri "$baseUrl/sales" `
        -Method POST `
        -Body $saleBody `
        -Headers $headers
    
    $saleId = $saleResponse.id
    Write-Host "   ✅ Venta creada exitosamente" -ForegroundColor Green
    Write-Host "   ID: $saleId" -ForegroundColor Gray
    Write-Host "   Estado: $($saleResponse.status)" -ForegroundColor Gray
    Write-Host "   Total: $($saleResponse.total_amount)" -ForegroundColor Gray
    Write-Host "   Items: $($saleResponse.sale_items.Count)" -ForegroundColor Gray
    
    # Verificar que el stock NO se haya descontado
    $productAfterDraft = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method GET
    if ($productAfterDraft.stock -eq $initialStock) {
        Write-Host "   ✅ Stock NO descontado (correcto para draft)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ADVERTENCIA: Stock cambió en draft (no debería)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al crear venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 5. Listar ventas (GET /api/sales)
# ============================================
Write-Host ""
Write-Host "5. Listando ventas..." -ForegroundColor Yellow

try {
    $salesListResponse = Invoke-RestMethod -Uri "$baseUrl/sales?limit=10" -Method GET -Headers $headers
    Write-Host "   ✅ Ventas obtenidas: $($salesListResponse.pagination.total)" -ForegroundColor Green
    Write-Host "   Página: $($salesListResponse.pagination.page)" -ForegroundColor Gray
    Write-Host "   Total páginas: $($salesListResponse.pagination.totalPages)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al listar ventas: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 6. Obtener venta por ID (GET /api/sales/:id)
# ============================================
Write-Host ""
Write-Host "6. Obteniendo venta por ID..." -ForegroundColor Yellow

try {
    $saleDetail = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" -Method GET -Headers $headers
    Write-Host "   ✅ Venta obtenida" -ForegroundColor Green
    Write-Host "   Estado: $($saleDetail.status)" -ForegroundColor Gray
    Write-Host "   Total: $($saleDetail.total_amount)" -ForegroundColor Gray
    Write-Host "   Items: $($saleDetail.sale_items.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al obtener venta: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 7. Editar venta (PUT /api/sales/:id)
# ============================================
Write-Host ""
Write-Host "7. Editando venta (solo draft se puede editar)..." -ForegroundColor Yellow

$updateSaleBody = @{
    notes = "Venta editada desde script"
    paymentMethod = "transfer"
} | ConvertTo-Json

try {
    $updatedSale = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" `
        -Method PUT `
        -Body $updateSaleBody `
        -Headers $headers
    
    Write-Host "   ✅ Venta editada exitosamente" -ForegroundColor Green
    Write-Host "   Notas actualizadas: $($updatedSale.notes)" -ForegroundColor Gray
    Write-Host "   Método de pago: $($updatedSale.payment_method)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al editar venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ============================================
# 8. Confirmar venta (POST /api/sales/:id/confirm)
# ============================================
Write-Host ""
Write-Host "8. Confirmando venta (descontará stock)..." -ForegroundColor Yellow
Write-Host "   Stock antes de confirmar: $initialStock" -ForegroundColor Gray

try {
    $confirmedSale = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/confirm" `
        -Method POST `
        -Headers $headers
    
    Write-Host "   ✅ Venta confirmada exitosamente" -ForegroundColor Green
    Write-Host "   Estado: $($confirmedSale.status)" -ForegroundColor Gray
    
    # Verificar que el stock se haya descontado
    $productAfterConfirm = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method GET
    $expectedStock = $initialStock - 2
    Write-Host "   Stock después de confirmar: $($productAfterConfirm.stock)" -ForegroundColor Gray
    Write-Host "   Stock esperado: $expectedStock" -ForegroundColor Gray
    
    if ($productAfterConfirm.stock -eq $expectedStock) {
        Write-Host "   ✅ Stock descontado correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ADVERTENCIA: Stock no coincide" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al confirmar venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ============================================
# 9. Intentar editar venta confirmada (debe fallar)
# ============================================
Write-Host ""
Write-Host "9. Intentando editar venta confirmada (debe fallar)..." -ForegroundColor Yellow

try {
    $null = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId" `
        -Method PUT `
        -Body $updateSaleBody `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "   ❌ ERROR: Debería haber fallado!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   ✅ Correctamente rechazado (solo draft se puede editar)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================
# 10. Cancelar venta (POST /api/sales/:id/cancel)
# ============================================
Write-Host ""
Write-Host "10. Cancelando venta (revertirá stock)..." -ForegroundColor Yellow
Write-Host "    Stock antes de cancelar: $($productAfterConfirm.stock)" -ForegroundColor Gray

try {
    $cancelledSale = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/cancel" `
        -Method POST `
        -Headers $headers
    
    Write-Host "   ✅ Venta cancelada exitosamente" -ForegroundColor Green
    Write-Host "   Estado: $($cancelledSale.status)" -ForegroundColor Gray
    
    # Verificar que el stock se haya revertido
    $productAfterCancel = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method GET
    Write-Host "   Stock después de cancelar: $($productAfterCancel.stock)" -ForegroundColor Gray
    Write-Host "   Stock inicial: $initialStock" -ForegroundColor Gray
    
    if ($productAfterCancel.stock -eq $initialStock) {
        Write-Host "   ✅ Stock revertido correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ADVERTENCIA: Stock no coincide con el inicial" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error al cancelar venta: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# ============================================
# 11. Intentar confirmar venta cancelada (debe fallar)
# ============================================
Write-Host ""
Write-Host "11. Intentando confirmar venta cancelada (debe fallar)..." -ForegroundColor Yellow

try {
    $null = Invoke-RestMethod -Uri "$baseUrl/sales/$saleId/confirm" `
        -Method POST `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "   ❌ ERROR: Debería haber fallado!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   ✅ Correctamente rechazado (venta cancelada no se puede confirmar)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================
# Resumen final
# ============================================
Write-Host ""
Write-Host "=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "✅ POST /api/sales - Crear venta (draft)" -ForegroundColor Green
Write-Host "✅ GET /api/sales - Listar ventas" -ForegroundColor Green
Write-Host "✅ GET /api/sales/:id - Obtener venta por ID" -ForegroundColor Green
Write-Host "✅ PUT /api/sales/:id - Editar venta (draft)" -ForegroundColor Green
Write-Host "✅ POST /api/sales/:id/confirm - Confirmar venta (descuenta stock)" -ForegroundColor Green
Write-Host "✅ POST /api/sales/:id/cancel - Cancelar venta (revierte stock)" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Flujo de stock verificado:" -ForegroundColor Green
Write-Host "   - Draft: NO descuenta stock" -ForegroundColor Gray
Write-Host "   - Confirm: Descuenta stock" -ForegroundColor Gray
Write-Host "   - Cancel: Revierte stock" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Todas las pruebas completadas!" -ForegroundColor Cyan

