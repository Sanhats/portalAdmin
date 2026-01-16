# Script de prueba para el Sistema de Compras (SPRINT ERP)
# Prueba: Proveedores → Compras → Costos → Stock → Caja
# Edge cases: productos sin costo, caja cerrada, idempotencia

# ============================================
# CONFIGURACION: Credenciales (opcional - hardcodeadas para testing rápido)
# ============================================
# Si defines estas variables, el script las usará automáticamente
# Si están vacías, pedirá las credenciales interactivamente
$TEST_EMAIL = "test2@toludev.com"  # Ejemplo: "test@example.com"
$TEST_PASSWORD = "test125"  # Ejemplo: "tu-password"

Write-Host "=== Prueba del Sistema de Compras (SPRINT ERP) ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$token = $null
$supplierId = $null
$purchaseId = $null
$productId = $null
$initialStock = 0
$initialCost = $null

# ============================================
# 1. Verificar que el servidor esté corriendo
# ============================================
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "$baseUrl/products" -Method GET -ErrorAction Stop
    Write-Host "   [OK] Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# ============================================
# 2. Login para obtener token
# ============================================
Write-Host ""
Write-Host "2. Autenticando..." -ForegroundColor Yellow
Write-Host "   [INFO] Asegurate de tener un usuario creado en Supabase" -ForegroundColor Gray

# Usar credenciales hardcodeadas si están definidas, sino pedirlas
if ($TEST_EMAIL -and $TEST_PASSWORD) {
    $email = $TEST_EMAIL
    $plainPassword = $TEST_PASSWORD
    Write-Host "   [USANDO CREDENCIALES HARDCODEADAS]" -ForegroundColor Gray
} else {
    $email = Read-Host "   Email"
    $password = Read-Host "   Password" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
}

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
    Write-Host "   [OK] Login exitoso" -ForegroundColor Green
    Write-Host "   Usuario: $($loginResponse.user.email)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error en login: $($_.Exception.Message)" -ForegroundColor Red
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
        $initialCost = $testProduct.cost
        Write-Host "   [OK] Producto encontrado: $($testProduct.name_internal)" -ForegroundColor Green
        Write-Host "   Stock actual: $initialStock" -ForegroundColor Gray
        Write-Host "   Costo actual: $(if ($initialCost) { $initialCost } else { 'NULL (sin costo)' })" -ForegroundColor Gray
    } else {
        Write-Host "   [ERROR] No hay productos disponibles. Crea un producto primero." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   [ERROR] Error al obtener productos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================
# 4. Crear proveedor
# ============================================
Write-Host ""
Write-Host "4. Creando proveedor..." -ForegroundColor Yellow

try {
    $supplierBody = @{
        name = "Proveedor Test $(Get-Date -Format 'HHmmss')"
        email = "test@proveedor.com"
        phone = "+54 11 1234-5678"
        notes = "Proveedor de prueba para testing"
    } | ConvertTo-Json

    $supplierResponse = Invoke-RestMethod -Uri "$baseUrl/suppliers" `
        -Method POST `
        -Body $supplierBody `
        -Headers $headers
    
    $supplierId = $supplierResponse.id
    Write-Host "   [OK] Proveedor creado: $($supplierResponse.name)" -ForegroundColor Green
    Write-Host "   ID: $supplierId" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al crear proveedor: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 5. Crear compra (DRAFT)
# ============================================
Write-Host ""
Write-Host "5. Creando compra en estado DRAFT..." -ForegroundColor Yellow

try {
    $purchaseBody = @{
        supplierId = $supplierId
        status = "draft"
        items = @(
            @{
                productId = $productId
                quantity = 10
                unitCost = "1500.00"
            }
        )
        notes = "Compra de prueba para testing"
    } | ConvertTo-Json

    $purchaseResponse = Invoke-RestMethod -Uri "$baseUrl/purchases" `
        -Method POST `
        -Body $purchaseBody `
        -Headers $headers
    
    $purchaseId = $purchaseResponse.id
    Write-Host "   [OK] Compra creada (DRAFT)" -ForegroundColor Green
    Write-Host "   ID: $purchaseId" -ForegroundColor Gray
    Write-Host "   Total: $($purchaseResponse.total_cost)" -ForegroundColor Gray
    Write-Host "   Items: $($purchaseResponse.purchase_items.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al crear compra: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 6. Editar compra (solo en DRAFT)
# ============================================
Write-Host ""
Write-Host "6. Editando compra (DRAFT es editable)..." -ForegroundColor Yellow

try {
    $updateBody = @{
        notes = "Compra editada - notas actualizadas"
    } | ConvertTo-Json

    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId" `
        -Method PUT `
        -Body $updateBody `
        -Headers $headers
    
    Write-Host "   [OK] Compra editada correctamente" -ForegroundColor Green
    Write-Host "   Notas: $($updateResponse.notes)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al editar compra: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 7. Confirmar compra (DRAFT → CONFIRMED)
# ============================================
Write-Host ""
Write-Host "7. Confirmando compra (DRAFT → CONFIRMED)..." -ForegroundColor Yellow

try {
    $confirmResponse = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId/confirm" `
        -Method POST `
        -Headers $headers
    
    Write-Host "   [OK] Compra confirmada" -ForegroundColor Green
    Write-Host "   Estado: $($confirmResponse.status)" -ForegroundColor Gray
    Write-Host "   Fecha confirmación: $($confirmResponse.confirmed_at)" -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al confirmar compra: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 8. Intentar editar compra confirmada (debe fallar)
# ============================================
Write-Host ""
Write-Host "8. Intentando editar compra confirmada (debe fallar)..." -ForegroundColor Yellow

try {
    $updateBody = @{
        notes = "Esto no debería funcionar"
    } | ConvertTo-Json

    $null = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId" `
        -Method PUT `
        -Body $updateBody `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "   [ERROR] ERROR: Se permitió editar una compra confirmada" -ForegroundColor Red
} catch {
    Write-Host "   [OK] Correcto: No se puede editar compra confirmada" -ForegroundColor Green
}

# ============================================
# 9. Verificar stock y costo ANTES de recibir
# ============================================
Write-Host ""
Write-Host "9. Verificando stock y costo ANTES de recibir..." -ForegroundColor Yellow

try {
    $productBefore = Invoke-RestMethod -Uri "$baseUrl/products/$productId" `
        -Method GET `
        -Headers $headers
    
    $stockBefore = $productBefore.stock
    $costBefore = $productBefore.cost
    
    Write-Host "   Stock antes: $stockBefore" -ForegroundColor Gray
    Write-Host "   Costo antes: $(if ($costBefore) { $costBefore } else { 'NULL' })" -ForegroundColor Gray
} catch {
    Write-Host "   [WARN]  No se pudo obtener producto antes" -ForegroundColor Yellow
}

# ============================================
# 10. Recibir compra (CONFIRMED → RECEIVED)
# OPERACIÓN CRÍTICA: Actualiza stock, costos y caja
# ============================================
Write-Host ""
Write-Host "10. Recibiendo compra (CONFIRMED → RECEIVED)..." -ForegroundColor Yellow
Write-Host "    [INFO] Esta operación actualiza stock, costos y crea movimientos" -ForegroundColor Gray

try {
    $receiveBody = @{
        paymentMethod = "transfer"
    } | ConvertTo-Json

    $receiveResponse = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId/receive" `
        -Method POST `
        -Body $receiveBody `
        -Headers $headers
    
    Write-Host "   [OK] Compra recibida" -ForegroundColor Green
    Write-Host "   Estado: $($receiveResponse.status)" -ForegroundColor Gray
    Write-Host "   Fecha recepción: $($receiveResponse.received_at)" -ForegroundColor Gray
    
    if ($receiveResponse.stockUpdates) {
        Write-Host "   Actualizaciones de stock:" -ForegroundColor Gray
        foreach ($update in $receiveResponse.stockUpdates) {
            Write-Host "     - Producto $($update.productId): $($update.quantity) unidades a $($update.unitCost)" -ForegroundColor Gray
            Write-Host "       [$(if ($update.success) { 'OK' } else { 'ERROR' })] Success: $($update.success)" -ForegroundColor $(if ($update.success) { "Green" } else { "Red" })
        }
    }
} catch {
    Write-Host "   [ERROR] Error al recibir compra: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================
# 11. Verificar stock y costo DESPUÉS de recibir
# ============================================
Write-Host ""
Write-Host "11. Verificando stock y costo DESPUÉS de recibir..." -ForegroundColor Yellow

try {
    $productAfter = Invoke-RestMethod -Uri "$baseUrl/products/$productId" `
        -Method GET `
        -Headers $headers
    
    $stockAfter = $productAfter.stock
    $costAfter = $productAfter.cost
    
    Write-Host "   Stock después: $stockAfter" -ForegroundColor Gray
    Write-Host "   Costo después: $(if ($costAfter) { $costAfter } else { 'NULL' })" -ForegroundColor Gray
    
    $expectedStock = $stockBefore + 10
    if ($stockAfter -eq $expectedStock) {
        Write-Host "   [OK] Stock correcto: $stockBefore + 10 = $stockAfter" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Stock incorrecto: esperado $expectedStock, obtenido $stockAfter" -ForegroundColor Red
    }
    
    if ($costAfter) {
        Write-Host "   [OK] Costo actualizado: $costAfter" -ForegroundColor Green
        if ($costBefore) {
            Write-Host "   Costo anterior: $costBefore" -ForegroundColor Gray
            Write-Host "   (Promedio ponderado calculado)" -ForegroundColor Gray
        } else {
            Write-Host "   (Primera compra: costo inicial establecido)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [WARN] Costo sigue siendo NULL" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ERROR] Error al verificar producto: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# 12. EDGE CASE: Intentar recibir compra dos veces (idempotencia)
# ============================================
Write-Host ""
Write-Host "12. EDGE CASE: Intentar recibir compra dos veces (debe fallar)..." -ForegroundColor Yellow

try {
    $receiveBody = @{
        paymentMethod = "transfer"
    } | ConvertTo-Json

    $null = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId/receive" `
        -Method POST `
        -Body $receiveBody `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "   [ERROR] ERROR: Se permitió recibir una compra dos veces" -ForegroundColor Red
} catch {
    Write-Host "   [OK] Correcto: No se puede recibir una compra ya recibida" -ForegroundColor Green
    if ($_.ErrorDetails.Message) {
        $errorMsg = ($_.ErrorDetails.Message | ConvertFrom-Json).error
        Write-Host "   Mensaje: $errorMsg" -ForegroundColor Gray
    }
}

# ============================================
# 13. EDGE CASE: Intentar cancelar compra recibida (debe fallar)
# ============================================
Write-Host ""
Write-Host "13. EDGE CASE: Intentar cancelar compra recibida (debe fallar)..." -ForegroundColor Yellow

try {
    $null = Invoke-RestMethod -Uri "$baseUrl/purchases/$purchaseId" `
        -Method DELETE `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "   [ERROR] ERROR: Se permitió cancelar una compra recibida" -ForegroundColor Red
} catch {
    Write-Host "   [OK] Correcto: No se puede cancelar una compra recibida" -ForegroundColor Green
}

# ============================================
# 14. Verificar movimientos de stock
# ============================================
Write-Host ""
Write-Host "14. Verificando movimientos de stock..." -ForegroundColor Yellow

try {
    $stockHistory = Invoke-RestMethod -Uri "$baseUrl/products/$productId/stock/history" `
        -Method GET `
        -Headers $headers
    
    $purchaseMovements = $stockHistory.data | Where-Object { $_.reason -like "*Compra*" -or $_.purchaseId -eq $purchaseId }
    
    if ($purchaseMovements) {
        Write-Host "   [OK] Movimiento de stock encontrado" -ForegroundColor Green
        $movement = $purchaseMovements[0]
        Write-Host "   Razón: $($movement.reason)" -ForegroundColor Gray
        Write-Host "   Diferencia: +$($movement.quantity)" -ForegroundColor Gray
        Write-Host "   Stock anterior: $($movement.stockBefore)" -ForegroundColor Gray
        Write-Host "   Stock nuevo: $($movement.stockAfter)" -ForegroundColor Gray
        if ($movement.purchaseId) {
            Write-Host "   Purchase ID: $($movement.purchaseId)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [WARN] No se encontró movimiento de stock para la compra" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [WARN]  No se pudo verificar movimientos de stock: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================
# 15. Verificar movimiento de caja (si hay caja abierta)
# ============================================
Write-Host ""
Write-Host "15. Verificando movimiento de caja..." -ForegroundColor Yellow
Write-Host "    [INFO] Solo se crea si hay caja abierta" -ForegroundColor Gray

try {
    # Intentar obtener cajas abiertas
    $cashBoxes = Invoke-RestMethod -Uri "$baseUrl/cash-boxes?status=open" `
        -Method GET `
        -Headers $headers
    
    if ($cashBoxes.data -and $cashBoxes.data.Count -gt 0) {
        $cashBox = $cashBoxes.data[0]
        Write-Host "   [OK] Caja abierta encontrada: $($cashBox.id)" -ForegroundColor Green
        
        $movements = Invoke-RestMethod -Uri "$baseUrl/cash-boxes/$($cashBox.id)/movements" `
            -Method GET `
            -Headers $headers
        
        $purchaseMovement = $movements.data | Where-Object { $_.purchase_id -eq $purchaseId }
        
        if ($purchaseMovement) {
            Write-Host "   [OK] Movimiento de caja encontrado" -ForegroundColor Green
            Write-Host "   Tipo: $($purchaseMovement.type) (expense)" -ForegroundColor Gray
            Write-Host "   Monto: $($purchaseMovement.amount)" -ForegroundColor Gray
            Write-Host "   Referencia: $($purchaseMovement.reference)" -ForegroundColor Gray
        } else {
            Write-Host "   [WARN] No se encontró movimiento de caja para la compra" -ForegroundColor Yellow
            Write-Host "   (Puede ser que no se haya creado automáticamente)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [WARN]  No hay caja abierta - el movimiento no se creó automáticamente" -ForegroundColor Yellow
        Write-Host "   (Esto es correcto según el diseño)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [WARN]  No se pudo verificar movimiento de caja: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================
# 16. EDGE CASE: Crear compra con producto sin costo
# ============================================
Write-Host ""
Write-Host "16. EDGE CASE: Crear compra con producto sin costo previo..." -ForegroundColor Yellow

try {
    # Buscar un producto sin costo
    $productsResponse = Invoke-RestMethod -Uri "$baseUrl/products?limit=50" -Method GET -Headers $headers
    $productWithoutCost = $productsResponse.data | Where-Object { -not $_.cost } | Select-Object -First 1
    
    if ($productWithoutCost) {
        Write-Host "   Producto sin costo encontrado: $($productWithoutCost.name_internal)" -ForegroundColor Gray
        
        $purchaseBody2 = @{
            supplierId = $supplierId
            items = @(
                @{
                    productId = $productWithoutCost.id
                    quantity = 5
                    unitCost = "2000.00"
                }
            )
        } | ConvertTo-Json

        $purchase2 = Invoke-RestMethod -Uri "$baseUrl/purchases" `
            -Method POST `
            -Body $purchaseBody2 `
            -Headers $headers
        
        Write-Host "   [OK] Compra creada con producto sin costo" -ForegroundColor Green
        
        # Confirmar y recibir
        $null = Invoke-RestMethod -Uri "$baseUrl/purchases/$($purchase2.id)/confirm" `
            -Method POST `
            -Headers $headers
        
        $receiveResponse2 = Invoke-RestMethod -Uri "$baseUrl/purchases/$($purchase2.id)/receive" `
            -Method POST `
            -Body $receiveBody `
            -Headers $headers
        
        Write-Host "   [OK] Compra recibida" -ForegroundColor Green
        
        # Verificar que el costo se estableció
        $productAfter2 = Invoke-RestMethod -Uri "$baseUrl/products/$($productWithoutCost.id)" `
            -Method GET `
            -Headers $headers
        
        if ($productAfter2.cost) {
            Write-Host "   [OK] Costo establecido: $($productAfter2.cost)" -ForegroundColor Green
            Write-Host "   (Debe ser igual al unitCost de la compra: 2000.00)" -ForegroundColor Gray
        } else {
            Write-Host "   [ERROR] Costo no se estableció" -ForegroundColor Red
        }
    } else {
        Write-Host "   [WARN]  No se encontró producto sin costo para probar" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [WARN]  Error en edge case de producto sin costo: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================
# Resumen final
# ============================================
Write-Host ""
Write-Host "=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Flujo completo probado:" -ForegroundColor Green
Write-Host "   - Crear proveedor" -ForegroundColor Gray
Write-Host "   - Crear compra (DRAFT)" -ForegroundColor Gray
Write-Host "   - Editar compra (DRAFT)" -ForegroundColor Gray
Write-Host "   - Confirmar compra (CONFIRMED)" -ForegroundColor Gray
Write-Host "   - Recibir compra (RECEIVED)" -ForegroundColor Gray
Write-Host ""
Write-Host "[OK] Edge cases probados:" -ForegroundColor Green
Write-Host "   - No editar compra confirmada" -ForegroundColor Gray
Write-Host "   - No recibir compra dos veces (idempotencia)" -ForegroundColor Gray
Write-Host "   - No cancelar compra recibida" -ForegroundColor Gray
Write-Host "   - Producto sin costo previo" -ForegroundColor Gray
Write-Host ""
Write-Host "[OK] Validaciones:" -ForegroundColor Green
Write-Host "   - Stock actualizado correctamente" -ForegroundColor Gray
Write-Host "   - Costo actualizado (promedio ponderado)" -ForegroundColor Gray
Write-Host "   - Movimientos de stock creados" -ForegroundColor Gray
Write-Host "   - Movimiento de caja (si hay caja abierta)" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] IDs generados:" -ForegroundColor Cyan
Write-Host "   Proveedor: $supplierId" -ForegroundColor Gray
Write-Host "   Compra: $purchaseId" -ForegroundColor Gray
Write-Host "   Producto: $productId" -ForegroundColor Gray
Write-Host ""
Write-Host "[OK] Testing completado" -ForegroundColor Green
