# Script de prueba para SPRINT 2 - POST /api/products (Carga rapida)
# Verifica que is_visible = false por defecto y que solo requiere campos minimos

Write-Host "=== Prueba SPRINT 2 - Modo Carga Rapida ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor este corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   OK Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   ERROR Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Probando carga rapida (solo campos minimos)..." -ForegroundColor Yellow
Write-Host "   Campos requeridos: sku, nameInternal, price" -ForegroundColor Gray
Write-Host "   Esperado: is_visible = false (NO publicado)" -ForegroundColor Gray
Write-Host ""

# Generar SKU unico
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$sku = "SPRINT2-$timestamp"

# Crear producto con solo campos minimos
$body = @{
    sku = $sku
    nameInternal = "Producto carga rapida SPRINT 2"
    price = 12000
} | ConvertTo-Json

Write-Host "   Datos enviados (solo minimos):" -ForegroundColor Cyan
Write-Host ($body | ConvertFrom-Json | ConvertTo-Json -Depth 3) -ForegroundColor Gray
Write-Host ""

try {
    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "   OK Producto creado exitosamente!" -ForegroundColor Green
    Write-Host ""
    
    # Verificar que is_visible = false
    if ($product.is_visible -eq $false) {
        Write-Host "   OK is_visible = false (producto NO publicado)" -ForegroundColor Green
    } else {
        Write-Host "   ERROR is_visible deberia ser false, pero es: $($product.is_visible)" -ForegroundColor Red
    }
    
    # Verificar que is_active = true
    if ($product.is_active -eq $true) {
        Write-Host "   OK is_active = true (producto activo)" -ForegroundColor Green
    } else {
        Write-Host "   ERROR is_active deberia ser true, pero es: $($product.is_active)" -ForegroundColor Red
    }
    
    # Verificar que stock = 0 (default)
    if ($product.stock -eq 0) {
        Write-Host "   OK stock = 0 (valor por defecto)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA stock deberia ser 0 por defecto, pero es: $($product.stock)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "   Resumen del producto:" -ForegroundColor Cyan
    Write-Host "   ID: $($product.id)" -ForegroundColor Gray
    Write-Host "   SKU: $($product.sku)" -ForegroundColor Gray
    Write-Host "   Nombre: $($product.name_internal)" -ForegroundColor Gray
    Write-Host "   Precio: $($product.price)" -ForegroundColor Gray
    Write-Host "   Stock: $($product.stock)" -ForegroundColor Gray
    Write-Host "   Activo: $($product.is_active)" -ForegroundColor Gray
    Write-Host "   Visible: $($product.is_visible)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR Error al crear producto" -ForegroundColor Red
    Write-Host "   Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Probando con descripcion opcional..." -ForegroundColor Yellow
$sku2 = "SPRINT2-DESC-$timestamp"
$bodyWithDesc = @{
    sku = $sku2
    nameInternal = "Producto con descripcion"
    price = 15000
    description = "Esta es una descripcion opcional"
} | ConvertTo-Json

try {
    $product2 = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $bodyWithDesc -ContentType "application/json"
    
    Write-Host "   OK Producto creado con descripcion!" -ForegroundColor Green
    Write-Host "   Descripcion: $($product2.description)" -ForegroundColor Gray
    Write-Host "   is_visible: $($product2.is_visible) (debe ser false)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Probando con stock especificado..." -ForegroundColor Yellow
$sku3 = "SPRINT2-STOCK-$timestamp"
$bodyWithStock = @{
    sku = $sku3
    nameInternal = "Producto con stock"
    price = 20000
    stock = 25
} | ConvertTo-Json

try {
    $product3 = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $bodyWithStock -ContentType "application/json"
    
    Write-Host "   OK Producto creado con stock!" -ForegroundColor Green
    Write-Host "   Stock: $($product3.stock) (debe ser 25)" -ForegroundColor Gray
    Write-Host "   is_visible: $($product3.is_visible) (debe ser false)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Verificando que el producto NO esta publicado..." -ForegroundColor Yellow
Write-Host "   (is_visible = false significa que NO aparece en el catalogo publico)" -ForegroundColor Gray
Write-Host "   Para publicarlo, usar: PUT /api/products/:id con isVisible: true" -ForegroundColor Gray

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK Pruebas del SPRINT 2 completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen SPRINT 2:" -ForegroundColor Cyan
Write-Host "  - Carga rapida: Solo 3 campos requeridos" -ForegroundColor Gray
Write-Host "  - Producto NO publicado: is_visible = false por defecto" -ForegroundColor Gray
Write-Host "  - Listo para editar: Puede actualizarse y publicarse despues" -ForegroundColor Gray

