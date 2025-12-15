# Script de prueba para SPRINT 1 - POST /api/products (Campos minimos)
# Prueba el endpoint con los campos requeridos: sku, nameInternal, price

Write-Host "=== Prueba SPRINT 1 - POST /api/products ===" -ForegroundColor Cyan
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
Write-Host "2. Probando POST /api/products con campos minimos del SPRINT 1..." -ForegroundColor Yellow
Write-Host "   Campos requeridos: sku, nameInternal, price" -ForegroundColor Gray
Write-Host ""

# Generar SKU unico basado en timestamp
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$sku = "PROD-$timestamp"

# Crear producto con campos minimos
$body = @{
    sku = $sku
    nameInternal = "Producto de prueba SPRINT 1"
    price = 15000
    stock = 50
} | ConvertTo-Json

Write-Host "   Datos a enviar:" -ForegroundColor Cyan
Write-Host ($body | ConvertFrom-Json | ConvertTo-Json -Depth 3) -ForegroundColor Gray
Write-Host ""

try {
    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "   OK Producto creado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Respuesta del servidor:" -ForegroundColor Cyan
    $product | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
    
    Write-Host ""
    Write-Host "   Resumen:" -ForegroundColor Cyan
    Write-Host "   ID: $($product.id)" -ForegroundColor Gray
    Write-Host "   SKU: $($product.sku)" -ForegroundColor Gray
    Write-Host "   Nombre interno: $($product.name_internal)" -ForegroundColor Gray
    Write-Host "   Precio: $($product.price)" -ForegroundColor Gray
    Write-Host "   Stock: $($product.stock)" -ForegroundColor Gray
    Write-Host "   Activo: $($product.is_active)" -ForegroundColor Gray
    Write-Host "   Visible: $($product.is_visible)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR Error al crear producto" -ForegroundColor Red
    Write-Host "   Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "   Detalles del error:" -ForegroundColor Yellow
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($errorJson) {
                Write-Host ($errorJson | ConvertTo-Json -Depth 3) -ForegroundColor Red
            } else {
                Write-Host $_.ErrorDetails.Message -ForegroundColor Red
            }
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
    
    if ($_.Exception.Response.StatusCode.value__) {
        Write-Host "   Codigo HTTP: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "3. Probando validacion (SKU duplicado - debe fallar)..." -ForegroundColor Yellow
try {
    # Intentar crear otro producto con el mismo SKU
    $duplicateBody = @{
        sku = $sku
        nameInternal = "Producto duplicado"
        price = 20000
    } | ConvertTo-Json
    
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $duplicateBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ERROR: Deberia haber fallado por SKU duplicado!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400 -or $_.Exception.Response.StatusCode.value__ -eq 500) {
        Write-Host "   OK Correctamente rechazado (SKU duplicado)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "4. Probando validacion (campos faltantes - debe fallar)..." -ForegroundColor Yellow
try {
    # Intentar crear producto sin SKU (requerido)
    $invalidBody = @{
        nameInternal = "Producto sin SKU"
        price = 10000
    } | ConvertTo-Json
    
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ERROR: Deberia haber fallado por campos faltantes!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (validacion de campos)" -ForegroundColor Green
        if ($_.ErrorDetails.Message) {
            try {
                $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorJson -and $errorJson.details) {
                    Write-Host "   Errores de validacion:" -ForegroundColor Gray
                    $errorJson.details | ForEach-Object {
                        Write-Host "      - $($_.path -join '.') : $($_.message)" -ForegroundColor Gray
                    }
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
Write-Host "5. Probando con valores por defecto (solo campos requeridos)..." -ForegroundColor Yellow
$minimalSku = "MIN-$timestamp"
$minimalBody = @{
    sku = $minimalSku
    nameInternal = "Producto minimo"
    price = 5000
} | ConvertTo-Json

Write-Host "   Solo enviando: sku, nameInternal, price" -ForegroundColor Gray
Write-Host "   (stock, isActive, isVisible deberian tener valores por defecto)" -ForegroundColor Gray
Write-Host ""

try {
    $minimalProduct = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $minimalBody -ContentType "application/json"
    
    Write-Host "   OK Producto creado con valores por defecto!" -ForegroundColor Green
    Write-Host "   Stock (default): $($minimalProduct.stock)" -ForegroundColor Gray
    Write-Host "   Activo (default): $($minimalProduct.is_active)" -ForegroundColor Gray
    Write-Host "   Visible (default): $($minimalProduct.is_visible)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK Pruebas del SPRINT 1 completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Nota: Si obtienes errores de base de datos, asegurate de haber ejecutado" -ForegroundColor Yellow
Write-Host "   la migracion SQL: drizzle/migration_sprint1_products.sql" -ForegroundColor Yellow
