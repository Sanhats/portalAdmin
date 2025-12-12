# 🧪 Cómo Probar el Sistema de Upload

Esta guía te ayudará a probar el sistema de upload de imágenes paso a paso.

---

## ✅ Verificación Inicial

### 1. Verificar que el servidor esté corriendo

```powershell
# Debería retornar la lista de productos (puede estar vacía)
Invoke-RestMethod -Uri "http://localhost:3000/api/products"
```

### 2. Verificar endpoint de upload (listar archivos)

```powershell
# Debería retornar un array vacío si no hay archivos
Invoke-RestMethod -Uri "http://localhost:3000/api/upload"
```

---

## 📤 Probar Upload de Imagen

### Opción 1: Usar curl.exe (Recomendado para PowerShell)

Si tienes `curl.exe` instalado (viene con Windows 10+):

```powershell
# Reemplaza "ruta\a\tu\imagen.jpg" con la ruta real de una imagen
curl.exe -X POST http://localhost:3000/api/upload -F "file=@C:\ruta\a\tu\imagen.jpg"
```

**Ejemplo:**
```powershell
curl.exe -X POST http://localhost:3000/api/upload -F "file=@C:\Users\HOME\Pictures\test.jpg"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "file": {
    "id": "products/1234567890-abc123.jpg",
    "fileName": "1234567890-abc123.jpg",
    "filePath": "products/1234567890-abc123.jpg",
    "url": "https://[tu-proyecto].supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg",
    "size": 123456,
    "type": "image/jpeg"
  }
}
```

---

### Opción 2: Crear una imagen de prueba

Si no tienes una imagen, puedes crear una simple con PowerShell:

```powershell
# Crear una imagen de prueba (1x1 pixel PNG)
$bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
[System.IO.File]::WriteAllBytes("$PWD\test-image.png", $bytes)
```

Luego subirla:
```powershell
curl.exe -X POST http://localhost:3000/api/upload -F "file=@$PWD\test-image.png"
```

---

### Opción 3: Usar desde el Frontend (JavaScript/TypeScript)

Si tienes un frontend, puedes probar así:

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('URL de la imagen:', result.file.url);
```

---

## 🔄 Flujo Completo: Subir Imagen y Crear Producto

### Paso 1: Subir la imagen

```powershell
# Subir imagen (reemplaza la ruta)
$uploadResponse = curl.exe -X POST http://localhost:3000/api/upload -F "file=@C:\ruta\a\tu\imagen.jpg" | ConvertFrom-Json

# Obtener la URL
$imageUrl = $uploadResponse.file.url
Write-Host "URL de la imagen: $imageUrl" -ForegroundColor Green
```

### Paso 2: Crear producto con la imagen

```powershell
$body = @{
    name = "Producto de Prueba"
    slug = "producto-de-prueba"
    description = "Producto creado para probar el sistema de upload"
    price = "99.99"
    stock = 10
    isFeatured = $false
    images = @(
        @{ imageUrl = $imageUrl }
    )
} | ConvertTo-Json -Depth 10

$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
Write-Host "Producto creado con ID: $($product.id)" -ForegroundColor Green
```

### Paso 3: Verificar el producto

```powershell
# Obtener el producto creado
$productId = $product.id
$productCreated = Invoke-RestMethod -Uri "http://localhost:3000/api/products/$productId"
Write-Host "Imágenes del producto:" -ForegroundColor Cyan
$productCreated.product_images | ForEach-Object {
    Write-Host "  - $($_.image_url)" -ForegroundColor Gray
}
```

---

## 🗑️ Probar Eliminación de Imagen

### Eliminar imagen de Storage

```powershell
# El filePath es el que obtuviste al subir (ej: "products/1234567890-abc123.jpg")
$filePath = "products/1234567890-abc123.jpg"
Invoke-RestMethod -Uri "http://localhost:3000/api/upload/$filePath" -Method DELETE
```

---

## ✅ Checklist de Pruebas

- [ ] GET /api/upload - Lista archivos (puede estar vacío)
- [ ] POST /api/upload - Subir imagen exitosamente
- [ ] Verificar que la URL retornada sea accesible
- [ ] Crear producto con la URL de la imagen
- [ ] Verificar que el producto tenga la imagen asociada
- [ ] DELETE /api/upload/[id] - Eliminar imagen

---

## 🐛 Solución de Problemas

### Error: "Bucket not found"
**Solución:** Verifica que el bucket `product-images` exista en Supabase Storage.

### Error: "new row violates row-level security policy"
**Solución:** Verifica que las políticas de Storage estén configuradas según `CONFIGURAR_SUPABASE_STORAGE.md`.

### Error: "File too large"
**Solución:** El archivo excede 5MB. Usa una imagen más pequeña.

### Error: "Tipo de archivo no permitido"
**Solución:** Solo se permiten imágenes: JPEG, PNG, WebP, GIF.

### La URL no se muestra en el navegador
**Solución:** 
1. Verifica que el bucket sea público
2. Verifica que la política de lectura esté activa
3. Verifica que la URL sea correcta

---

## 🎯 Prueba Rápida (Script Completo)

Guarda esto como `probar-upload-completo.ps1`:

```powershell
# 1. Crear imagen de prueba
$bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
$testImagePath = "$PWD\test-upload.png"
[System.IO.File]::WriteAllBytes($testImagePath, $bytes)
Write-Host "Imagen de prueba creada: $testImagePath" -ForegroundColor Green

# 2. Subir imagen
Write-Host "Subiendo imagen..." -ForegroundColor Yellow
$uploadResult = curl.exe -X POST http://localhost:3000/api/upload -F "file=@$testImagePath" 2>&1 | ConvertFrom-Json

if ($uploadResult.success) {
    Write-Host "✅ Imagen subida exitosamente!" -ForegroundColor Green
    Write-Host "URL: $($uploadResult.file.url)" -ForegroundColor Cyan
    
    # 3. Crear producto con la imagen
    Write-Host "Creando producto..." -ForegroundColor Yellow
    $body = @{
        name = "Producto Test Upload"
        slug = "producto-test-upload"
        price = "50.00"
        stock = 1
        images = @(
            @{ imageUrl = $uploadResult.file.url }
        )
    } | ConvertTo-Json -Depth 10
    
    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Producto creado con ID: $($product.id)" -ForegroundColor Green
    Write-Host "   Verifica en: http://localhost:3000/api/products/$($product.id)" -ForegroundColor Cyan
    
    # 4. Limpiar imagen de prueba
    Remove-Item $testImagePath
    Write-Host "Imagen de prueba eliminada" -ForegroundColor Gray
} else {
    Write-Host "❌ Error al subir imagen" -ForegroundColor Red
}
```

---

**¡Listo para probar!** 🚀

