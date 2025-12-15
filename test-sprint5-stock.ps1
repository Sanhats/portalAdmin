# Script de prueba para SPRINT 5 - PATCH /api/products/:id y PATCH /api/products/:id/stock

Write-Host "=== Prueba SPRINT 5 - Actualizacion y Stock ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor este corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   OK Servidor funcionando" -ForegroundColor Green
    
    # Obtener un producto existente para las pruebas
    if ($response.data -and $response.data.Count -gt 0) {
        $testProduct = $response.data[0]
        $productId = $testProduct.id
        $currentStock = $testProduct.stock
        Write-Host "   Producto de prueba: $($testProduct.sku) (Stock actual: $currentStock)" -ForegroundColor Gray
    } else {
        Write-Host "   ADVERTENCIA: No hay productos en la base de datos" -ForegroundColor Yellow
        Write-Host "   Creando un producto de prueba..." -ForegroundColor Yellow
        
        # Crear producto de prueba
        $newProductBody = @{
            sku = "TEST-STOCK-$(Get-Date -Format 'yyyyMMddHHmmss')"
            nameInternal = "Producto de prueba stock"
            price = 10000
            stock = 10
        } | ConvertTo-Json
        
        $newProduct = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $newProductBody -ContentType "application/json"
        $productId = $newProduct.id
        $currentStock = $newProduct.stock
        Write-Host "   OK Producto creado: $($newProduct.sku) (Stock: $currentStock)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ERROR Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Probando PATCH /api/products/:id/stock (actualizar solo stock)..." -ForegroundColor Yellow
Write-Host "   Stock actual: $currentStock" -ForegroundColor Gray

$newStock = $currentStock + 5
$stockBody = @{
    stock = $newStock
    reason = "Ajuste de inventario desde script"
} | ConvertTo-Json

Write-Host "   Actualizando stock a: $newStock" -ForegroundColor Cyan

try {
    $stockResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId/stock" `
        -Method PATCH `
        -Body $stockBody `
        -ContentType "application/json"
    
    Write-Host "   OK Stock actualizado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Respuesta:" -ForegroundColor Cyan
    Write-Host "   Stock anterior: $($stockResponse.stockChange.previous)" -ForegroundColor Gray
    Write-Host "   Stock nuevo: $($stockResponse.stockChange.current)" -ForegroundColor Gray
    Write-Host "   Diferencia: $($stockResponse.stockChange.difference)" -ForegroundColor Gray
    
    if ($stockResponse.stockChange.difference -gt 0) {
        Write-Host "   Tipo: Entrada de stock" -ForegroundColor Green
    } elseif ($stockResponse.stockChange.difference -lt 0) {
        Write-Host "   Tipo: Salida de stock" -ForegroundColor Yellow
    } else {
        Write-Host "   Tipo: Sin cambio" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ERROR Error al actualizar stock" -ForegroundColor Red
    Write-Host "   Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Probando validacion (stock negativo - debe fallar)..." -ForegroundColor Yellow

$negativeStockBody = @{
    stock = -5
} | ConvertTo-Json

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId/stock" `
        -Method PATCH `
        -Body $negativeStockBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "   ERROR Deberia haber fallado por stock negativo!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (stock negativo)" -ForegroundColor Green
        if ($_.ErrorDetails.Message) {
            try {
                $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorJson -and $errorJson.error) {
                    Write-Host "   Mensaje: $($errorJson.error)" -ForegroundColor Gray
                }
            } catch {
                # Ignorar errores de parsing
            }
        }
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "4. Probando PATCH /api/products/:id (actualizacion parcial)..." -ForegroundColor Yellow

$partialUpdateBody = @{
    stock = 30
    price = 12000
    isVisible = $true
} | ConvertTo-Json

Write-Host "   Actualizando: stock=30, price=12000, isVisible=true" -ForegroundColor Cyan

try {
    $partialResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId" `
        -Method PATCH `
        -Body $partialUpdateBody `
        -ContentType "application/json"
    
    Write-Host "   OK Producto actualizado exitosamente!" -ForegroundColor Green
    Write-Host "   Stock: $($partialResponse.stock)" -ForegroundColor Gray
    Write-Host "   Precio: $($partialResponse.price)" -ForegroundColor Gray
    Write-Host "   Visible: $($partialResponse.is_visible)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Probando validacion (stock negativo en PATCH /products/:id)..." -ForegroundColor Yellow

$negativeStockBody2 = @{
    stock = -10
} | ConvertTo-Json

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId" `
        -Method PATCH `
        -Body $negativeStockBody2 `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "   ERROR Deberia haber fallado por stock negativo!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (stock negativo)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "6. Probando actualizacion de stock a cero..." -ForegroundColor Yellow

$zeroStockBody = @{
    stock = 0
    reason = "Stock agotado"
} | ConvertTo-Json

try {
    $zeroResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId/stock" `
        -Method PATCH `
        -Body $zeroStockBody `
        -ContentType "application/json"
    
    Write-Host "   OK Stock actualizado a cero exitosamente!" -ForegroundColor Green
    Write-Host "   Stock: $($zeroResponse.stock)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK Pruebas del SPRINT 5 completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen SPRINT 5:" -ForegroundColor Cyan
Write-Host "  - PATCH /api/products/:id: Actualizacion parcial" -ForegroundColor Gray
Write-Host "  - PATCH /api/products/:id/stock: Actualizacion especifica de stock" -ForegroundColor Gray
Write-Host "  - Validacion: Stock no puede ser negativo" -ForegroundColor Gray
Write-Host "  - Registro de movimientos: Preparado para ventas futuras" -ForegroundColor Gray

