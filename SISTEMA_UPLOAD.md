# 📤 Sistema de Upload de Imágenes - Documentación Completa

**Estado:** ✅ Implementado  
**Fecha:** Diciembre 2024

---

## 📋 Resumen

El sistema de upload permite subir imágenes de productos a Supabase Storage y obtener URLs públicas para usar en los productos.

---

## 🔧 Configuración Requerida

Antes de usar el sistema de upload, debes configurar Supabase Storage:

1. **Crear bucket `product-images`** en Supabase
2. **Configurar políticas** (ver `CONFIGURAR_SUPABASE_STORAGE.md`)

---

## 📡 Endpoints Disponibles

### 1. POST /api/upload
**Subir una imagen a Supabase Storage**

#### Request:
- **Content-Type:** `multipart/form-data`
- **Body:** FormData con campo `file`

#### Validaciones:
- ✅ Tipo de archivo: Solo imágenes (JPEG, PNG, WebP, GIF)
- ✅ Tamaño máximo: 5MB
- ✅ Genera nombre único automáticamente

#### Respuesta Exitosa (201):
```json
{
  "success": true,
  "file": {
    "id": "products/1234567890-abc123.jpg",
    "fileName": "1234567890-abc123.jpg",
    "filePath": "products/1234567890-abc123.jpg",
    "url": "https://[project].supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg",
    "size": 123456,
    "type": "image/jpeg"
  }
}
```

#### Errores:
- `400`: Archivo no proporcionado, tipo no permitido, o tamaño excedido
- `500`: Error del servidor o de Supabase

---

### 2. DELETE /api/upload/[id]
**Eliminar una imagen de Supabase Storage**

#### Parámetros:
- `id` (path): Ruta completa del archivo (ej: `products/1234567890-abc123.jpg`)

#### Respuesta Exitosa (200):
```json
{
  "success": true,
  "message": "Archivo eliminado correctamente",
  "filePath": "products/1234567890-abc123.jpg"
}
```

#### Errores:
- `400`: ID no proporcionado
- `500`: Error del servidor

---

### 3. GET /api/upload
**Listar archivos subidos (para debugging)**

#### Respuesta:
```json
{
  "files": [
    {
      "name": "1234567890-abc123.jpg",
      "id": "...",
      "updated_at": "...",
      "created_at": "...",
      "last_accessed_at": "...",
      "metadata": {},
      "url": "https://..."
    }
  ],
  "count": 1
}
```

---

## 🔄 Flujo de Trabajo Recomendado

### Opción 1: Upload Separado (Recomendado)

**Paso 1:** Subir imágenes a `/api/upload`
```powershell
# Subir imagen
$formData = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead("C:\ruta\a\imagen.jpg")
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/jpeg")
$formData.Add($fileContent, "file", "imagen.jpg")

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" -Method POST -Body $formData
$imageUrl = $response.file.url
```

**Paso 2:** Crear producto con la URL obtenida
```powershell
$body = @{
    name = "Producto con Imagen"
    slug = "producto-con-imagen"
    price = "99.99"
    images = @(
        @{ imageUrl = $imageUrl }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
```

### Opción 2: URLs Directas

Si ya tienes URLs de imágenes (de otro servicio o subidas previamente):

```powershell
$body = @{
    name = "Producto"
    slug = "producto"
    price = "99.99"
    images = @(
        @{ imageUrl = "https://ejemplo.com/imagen1.jpg" },
        @{ imageUrl = "https://ejemplo.com/imagen2.jpg" }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
```

---

## 💻 Ejemplos de Uso

### Ejemplo 1: Subir una imagen (PowerShell)

```powershell
# Nota: PowerShell no tiene soporte nativo para multipart/form-data
# Necesitarás usar una librería o hacerlo desde el frontend
# O usar curl.exe si está disponible:

curl.exe -X POST http://localhost:3000/api/upload `
  -F "file=@C:\ruta\a\imagen.jpg"
```

### Ejemplo 2: Subir múltiples imágenes y crear producto

**Desde el frontend (JavaScript/TypeScript):**

```typescript
// 1. Subir imágenes
const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
};

// 2. Subir todas las imágenes
const files = [file1, file2, file3];
const uploadResults = await Promise.all(
  files.map(file => uploadImage(file))
);

// 3. Obtener URLs
const imageUrls = uploadResults
  .filter(result => result.success)
  .map(result => result.file.url);

// 4. Crear producto con las URLs
const product = {
  name: "Producto con Imágenes",
  slug: "producto-con-imagenes",
  price: "99.99",
  images: imageUrls.map(url => ({ imageUrl: url }))
};

await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(product),
});
```

---

## 🔗 Integración con Productos

### Al Crear Producto (POST /api/products)

El endpoint acepta imágenes de dos formas:

1. **URLs directas** (ya subidas):
```json
{
  "images": [
    { "imageUrl": "https://..." }
  ]
}
```

2. **Subir primero a /api/upload**, obtener URLs, luego crear producto

### Al Actualizar Producto (PUT /api/products)

Funciona igual que crear:
- Puedes enviar nuevas URLs
- Las imágenes existentes se reemplazan completamente

---

## 🗑️ Eliminación de Imágenes

### Eliminar imagen de Storage

```powershell
# El id es la ruta completa del archivo
$filePath = "products/1234567890-abc123.jpg"
Invoke-RestMethod -Uri "http://localhost:3000/api/upload/$filePath" -Method DELETE
```

### Eliminar producto (cascada automática)

Cuando eliminas un producto con `DELETE /api/products/[id]`, las imágenes relacionadas en la BD se eliminan automáticamente (cascade), pero **NO se eliminan de Storage**.

**Recomendación:** Implementar limpieza de Storage cuando se elimine un producto (futura mejora).

---

## ⚙️ Configuración

### Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

### Bucket Name

El bucket debe llamarse exactamente: `product-images`

Si quieres usar otro nombre, actualiza la constante `BUCKET_NAME` en:
- `src/app/api/upload/route.ts`
- `src/app/api/upload/[id]/route.ts`
- `src/lib/upload.ts`

---

## 📊 Límites y Restricciones

- **Tamaño máximo por archivo:** 5MB
- **Tipos permitidos:** JPEG, PNG, WebP, GIF
- **Carpeta de almacenamiento:** `products/` dentro del bucket
- **Nombres de archivo:** Generados automáticamente (timestamp + random)

---

## 🆘 Solución de Problemas

### Error: "Bucket not found"
**Solución:** Verifica que el bucket `product-images` exista en Supabase Storage.

### Error: "new row violates row-level security policy"
**Solución:** Verifica que las políticas de Storage estén configuradas correctamente (ver `CONFIGURAR_SUPABASE_STORAGE.md`).

### Error: "File too large"
**Solución:** El archivo excede 5MB. Comprime la imagen o aumenta el límite en el código.

### Las imágenes no se muestran
**Solución:** 
1. Verifica que el bucket sea público
2. Verifica que la política de lectura esté activa
3. Verifica que la URL sea correcta

---

## 🎯 Próximas Mejoras (Opcional)

- [ ] Soporte para múltiples archivos en una sola request
- [ ] Limpieza automática de Storage al eliminar producto
- [ ] Redimensionamiento automático de imágenes
- [ ] Generación de thumbnails
- [ ] Validación de dimensiones mínimas/máximas

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Funcional y listo para usar

