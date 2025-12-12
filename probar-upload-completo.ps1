# Script completo para probar el sistema de upload

Write-Host "=== Prueba Completa del Sistema de Upload ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar servidor
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# 2. Crear imagen de prueba (1x1 pixel PNG)
Write-Host ""
Write-Host "2. Creando imagen de prueba..." -ForegroundColor Yellow
$testImagePath = "$PWD\test-upload-$(Get-Date -Format 'yyyyMMddHHmmss').png"
$bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
[System.IO.File]::WriteAllBytes($testImagePath, $bytes)
Write-Host "   ✅ Imagen creada: $testImagePath" -ForegroundColor Green

# 3. Subir imagen
Write-Host ""
Write-Host "3. Subiendo imagen a Supabase Storage..." -ForegroundColor Yellow
try {
    $uploadOutput = curl.exe -X POST http://localhost:3000/api/upload -F "file=@$testImagePath" 2>&1
    $uploadResult = $uploadOutput | ConvertFrom-Json
    
    if ($uploadResult.success) {
        Write-Host "   ✅ Imagen subida exitosamente!" -ForegroundColor Green
        Write-Host "   📁 Archivo: $($uploadResult.file.fileName)" -ForegroundColor Gray
        Write-Host "   🔗 URL: $($uploadResult.file.url)" -ForegroundColor Cyan
        $imageUrl = $uploadResult.file.url
        $filePath = $uploadResult.file.filePath
    } else {
        Write-Host "   ❌ Error al subir imagen" -ForegroundColor Red
        Remove-Item $testImagePath -ErrorAction SilentlyContinue
        exit 1
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Detalles: $uploadOutput" -ForegroundColor Red
    Remove-Item $testImagePath -ErrorAction SilentlyContinue
    exit 1
}

# 4. Verificar que la URL sea accesible
Write-Host ""
Write-Host "4. Verificando que la URL sea accesible..." -ForegroundColor Yellow
try {
    $imageCheck = Invoke-WebRequest -Uri $imageUrl -Method HEAD -ErrorAction Stop
    Write-Host "   ✅ URL accesible (Status: $($imageCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  No se pudo verificar la URL (puede ser normal si el bucket no es público)" -ForegroundColor Yellow
}

# 5. Crear producto con la imagen
Write-Host ""
Write-Host "5. Creando producto con la imagen subida..." -ForegroundColor Yellow
try {
    $body = @{
        name = "Producto Test Upload $(Get-Date -Format 'HH:mm:ss')"
        slug = "producto-test-upload-$(Get-Date -Format 'yyyyMMddHHmmss')"
        description = "Producto creado automáticamente para probar el sistema de upload"
        price = "99.99"
        stock = 1
        isFeatured = $false
        images = @(
            @{ imageUrl = $imageUrl }
        )
    } | ConvertTo-Json -Depth 10
    
    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
    Write-Host "   ✅ Producto creado exitosamente!" -ForegroundColor Green
    Write-Host "   🆔 ID: $($product.id)" -ForegroundColor Cyan
    Write-Host "   📦 Nombre: $($product.name)" -ForegroundColor Gray
    Write-Host "   🖼️  Imágenes: $($product.product_images.Count)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error al crear producto: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Remove-Item $testImagePath -ErrorAction SilentlyContinue
    exit 1
}

# 6. Verificar el producto creado
Write-Host ""
Write-Host "6. Verificando producto creado..." -ForegroundColor Yellow
try {
    $productCreated = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$($product.id)"
    Write-Host "   ✅ Producto verificado" -ForegroundColor Green
    Write-Host "   🖼️  Imágenes asociadas:" -ForegroundColor Cyan
    $productCreated.product_images | ForEach-Object {
        Write-Host "      - $($_.image_url)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  No se pudo verificar el producto" -ForegroundColor Yellow
}

# 7. Limpiar imagen de prueba local
Write-Host ""
Write-Host "7. Limpiando archivos temporales..." -ForegroundColor Yellow
Remove-Item $testImagePath -ErrorAction SilentlyContinue
Write-Host "   ✅ Archivo local eliminado" -ForegroundColor Green

# Resumen
Write-Host ""
Write-Host "=== Resumen ===" -ForegroundColor Cyan
Write-Host "✅ Imagen subida a Supabase Storage" -ForegroundColor Green
Write-Host "✅ Producto creado con la imagen" -ForegroundColor Green
Write-Host "✅ Sistema de upload funcionando correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   - Verifica el producto en: http://localhost:3000/api/products/$($product.id)" -ForegroundColor Gray
Write-Host "   - Verifica la imagen en: $imageUrl" -ForegroundColor Gray
Write-Host "   - Para eliminar la imagen de Storage, usa el filePath obtenido arriba" -ForegroundColor Gray
Write-Host ""

