# Script de prueba para SPRINT 3 - POST /api/products (Carga completa)
# Prueba la estructura anidada con internal, public, variants e images

Write-Host "=== Prueba SPRINT 3 - Modo Carga Completa ===" -ForegroundColor Cyan
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
Write-Host "2. Probando carga completa (SPRINT 3) con estructura anidada..." -ForegroundColor Yellow
Write-Host "   Estructura: sku, internal, public, variants, images" -ForegroundColor Gray
Write-Host ""

# Generar SKU unico
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$sku = "SPRINT3-$timestamp"

# Crear producto completo con estructura anidada
$body = @{
    sku = $sku
    internal = @{
        nameInternal = "Producto interno SPRINT 3"
        price = 15000
        stock = 25
        categoryId = $null
        isActive = $true
        isVisible = $true
    }
    public = @{
        name = "Producto Publico SPRINT 3"
        slug = "producto-publico-sprint3-$timestamp"
        description = "Descripcion completa del producto publico"
        isFeatured = $true
    }
    variants = @(
        @{
            name = "Talla"
            value = "M"
        },
        @{
            name = "Color"
            value = "Rojo"
        }
    )
    images = @(
        @{
            imageUrl = "https://example.com/image1.jpg"
        },
        @{
            imageUrl = "https://example.com/image2.jpg"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "   Datos enviados (estructura anidada):" -ForegroundColor Cyan
Write-Host ($body | ConvertFrom-Json | ConvertTo-Json -Depth 10) -ForegroundColor Gray
Write-Host ""

try {
    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "   OK Producto creado exitosamente!" -ForegroundColor Green
    Write-Host ""
    
    # Verificar estructura de respuesta
    Write-Host "   Verificando estructura de respuesta..." -ForegroundColor Cyan
    
    if ($product.id) {
        Write-Host "   OK ID del producto: $($product.id)" -ForegroundColor Green
    } else {
        Write-Host "   ERROR Falta ID del producto" -ForegroundColor Red
    }
    
    if ($product.sku) {
        Write-Host "   OK SKU: $($product.sku)" -ForegroundColor Green
    } else {
        Write-Host "   ERROR Falta SKU" -ForegroundColor Red
    }
    
    if ($product.product_public_data) {
        Write-Host "   OK Datos publicos encontrados" -ForegroundColor Green
        Write-Host "      - Nombre publico: $($product.product_public_data.name)" -ForegroundColor Gray
        Write-Host "      - Slug: $($product.product_public_data.slug)" -ForegroundColor Gray
        Write-Host "      - Descripcion: $($product.product_public_data.description)" -ForegroundColor Gray
        Write-Host "      - Destacado: $($product.product_public_data.is_featured)" -ForegroundColor Gray
    } else {
        Write-Host "   ERROR Falta product_public_data" -ForegroundColor Red
    }
    
    if ($product.variants -and $product.variants.Count -gt 0) {
        Write-Host "   OK Variantes encontradas: $($product.variants.Count)" -ForegroundColor Green
        $product.variants | ForEach-Object {
            Write-Host "      - $($_.name): $($_.value)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ERROR No se encontraron variantes" -ForegroundColor Red
    }
    
    if ($product.product_images -and $product.product_images.Count -gt 0) {
        Write-Host "   OK Imagenes encontradas: $($product.product_images.Count)" -ForegroundColor Green
        $product.product_images | ForEach-Object {
            Write-Host "      - $($_.image_url)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ERROR No se encontraron imagenes" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "   Resumen completo:" -ForegroundColor Cyan
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
Write-Host "3. Probando validacion estricta (campos faltantes en internal)..." -ForegroundColor Yellow
$sku2 = "SPRINT3-INVALID-$timestamp"
$invalidBody = @{
    sku = $sku2
    internal = @{
        nameInternal = "Producto sin precio"
        # Falta price (requerido)
        stock = 10
        isActive = $true
        isVisible = $true
    }
    public = @{
        name = "Producto Publico"
        slug = "producto-publico-invalid-$timestamp"
    }
} | ConvertTo-Json -Depth 10

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ERROR Deberia haber fallado por campos faltantes!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (validacion estricta)" -ForegroundColor Green
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
Write-Host "4. Probando validacion estricta (campos faltantes en public)..." -ForegroundColor Yellow
$sku3 = "SPRINT3-NOSLUG-$timestamp"
$invalidBody2 = @{
    sku = $sku3
    internal = @{
        nameInternal = "Producto completo"
        price = 20000
        stock = 15
        isActive = $true
        isVisible = $true
    }
    public = @{
        name = "Producto sin slug"
        # Falta slug (requerido)
        description = "Descripcion"
    }
} | ConvertTo-Json -Depth 10

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $invalidBody2 -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ERROR Deberia haber fallado por slug faltante!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (slug requerido)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "5. Probando control explicito de visibilidad..." -ForegroundColor Yellow
Write-Host "   (isVisible debe ser especificado explicitamente, sin defaults)" -ForegroundColor Gray
$sku4 = "SPRINT3-VISIBLE-$timestamp"
$visibleBody = @{
    sku = $sku4
    internal = @{
        nameInternal = "Producto visible"
        price = 18000
        stock = 30
        isActive = $true
        isVisible = $true  # Explicito
    }
    public = @{
        name = "Producto Visible Publico"
        slug = "producto-visible-$timestamp"
    }
} | ConvertTo-Json -Depth 10

try {
    $visibleProduct = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $visibleBody -ContentType "application/json"
    
    Write-Host "   OK Producto creado con isVisible explicito" -ForegroundColor Green
    Write-Host "   is_visible: $($visibleProduct.is_visible) (debe ser true)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "6. Probando stock inicial consistente (requerido, sin default)..." -ForegroundColor Yellow
$sku5 = "SPRINT3-NOSTOCK-$timestamp"
$noStockBody = @{
    sku = $sku5
    internal = @{
        nameInternal = "Producto sin stock"
        price = 10000
        # Falta stock (requerido en SPRINT 3)
        isActive = $true
        isVisible = $false
    }
    public = @{
        name = "Producto Sin Stock"
        slug = "producto-sin-stock-$timestamp"
    }
} | ConvertTo-Json -Depth 10

try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $noStockBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ERROR Deberia haber fallado por stock faltante!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (stock requerido)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "7. Probando con variantes e imagenes opcionales..." -ForegroundColor Yellow
$sku6 = "SPRINT3-MIN-$timestamp"
$minimalBody = @{
    sku = $sku6
    internal = @{
        nameInternal = "Producto minimo SPRINT 3"
        price = 12000
        stock = 5
        isActive = $true
        isVisible = $false
    }
    public = @{
        name = "Producto Minimo"
        slug = "producto-minimo-$timestamp"
    }
    # Sin variants ni images (opcionales)
} | ConvertTo-Json -Depth 10

try {
    $minimalProduct = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $minimalBody -ContentType "application/json"
    
    Write-Host "   OK Producto creado sin variantes ni imagenes" -ForegroundColor Green
    Write-Host "   Variantes: $($minimalProduct.variants.Count) (debe ser 0 o null)" -ForegroundColor Gray
    Write-Host "   Imagenes: $($minimalProduct.product_images.Count) (debe ser 0 o null)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK Pruebas del SPRINT 3 completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen SPRINT 3:" -ForegroundColor Cyan
Write-Host "  - Estructura anidada: internal y public separados" -ForegroundColor Gray
Write-Host "  - Validaciones estrictas: todos los campos requeridos" -ForegroundColor Gray
Write-Host "  - Control explicito: isVisible sin defaults" -ForegroundColor Gray
Write-Host "  - Stock consistente: requerido, sin default" -ForegroundColor Gray
Write-Host "  - Variantes e imagenes: opcionales" -ForegroundColor Gray
Write-Host ""
Write-Host "Nota: Asegurate de haber ejecutado la migracion SQL:" -ForegroundColor Yellow
Write-Host "   drizzle/migration_sprint3_products.sql" -ForegroundColor Yellow

