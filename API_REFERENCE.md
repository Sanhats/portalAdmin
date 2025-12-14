# 📚 API Reference - Documentación Completa

**Base URL:** `http://localhost:3000/api` (desarrollo)  
**Versión:** 1.0.0  
**Fecha:** Diciembre 2024

---

## 📋 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Categorías](#categorías)
3. [Productos](#productos)
4. [Upload de Imágenes](#upload-de-imágenes)
5. [Códigos de Estado HTTP](#códigos-de-estado-http)
6. [Manejo de Errores](#manejo-de-errores)

---

## 🔐 Autenticación

La mayoría de los endpoints requieren autenticación mediante Bearer Token. Obtén el token mediante el endpoint de login.

### Headers Requeridos (Endpoints Protegidos)

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

---

## 🔑 Autenticación

### POST /api/auth/login

Iniciar sesión y obtener token de acceso.

**Autenticación:** No requerida (público)

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Validaciones:**
- `email`: Email válido, 1-255 caracteres
- `password`: Mínimo 6 caracteres, máximo 100 caracteres

**Response 200 OK:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": 1234567890,
    "expires_in": 3600
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["email"],
      "message": "Email inválido"
    }
  ]
}
```

**Response 401 Unauthorized:**
```json
{
  "error": "Credenciales inválidas",
  "details": "Invalid login credentials"
}
```

**Ejemplo (PowerShell):**
```powershell
$body = @{
  email = "admin@example.com"
  password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"

$token = $response.session.access_token
```

---

## 📁 Categorías

### GET /api/categories

Obtener todas las categorías.

**Autenticación:** No requerida (público)

**Response 200 OK:**
```json
[
  {
    "id": "uuid",
    "name": "Electrónicos",
    "slug": "electronicos",
    "created_at": "2024-12-01T00:00:00.000Z"
  },
  {
    "id": "uuid",
    "name": "Ropa",
    "slug": "ropa",
    "created_at": "2024-12-01T00:00:00.000Z"
  }
]
```

**Ejemplo (PowerShell):**
```powershell
$categories = Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET
```

---

### POST /api/categories

Crear una nueva categoría.

**Autenticación:** Requerida (Bearer Token)

**Request Body:**
```json
{
  "name": "Electrónicos",
  "slug": "electronicos"
}
```

**Validaciones:**
- `name`: String, 1-255 caracteres, requerido
- `slug`: String, 1-255 caracteres, formato: `a-z0-9-`, requerido

**Response 201 Created:**
```json
[
  {
    "id": "uuid",
    "name": "Electrónicos",
    "slug": "electronicos",
    "created_at": "2024-12-01T00:00:00.000Z"
  }
]
```

**Response 400 Bad Request:**
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["slug"],
      "message": "El slug debe contener solo letras minúsculas, números y guiones"
    }
  ]
}
```

**Response 401 Unauthorized:**
```json
{
  "error": "No autorizado"
}
```

**Ejemplo (PowerShell):**
```powershell
$body = @{
  name = "Electrónicos"
  slug = "electronicos"
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$category = Invoke-RestMethod -Uri "http://localhost:3000/api/categories" `
  -Method POST `
  -Body $body `
  -Headers $headers
```

---

## 🛍️ Productos

### GET /api/products

Listar productos con filtros, paginación e includes.

**Autenticación:** No requerida (público)

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Productos por página (default: 10)
- `categoryId` (opcional): Filtrar por categoría usando UUID
- `categorySlug` (opcional): Filtrar por categoría usando slug (más amigable para URLs)
- `isFeatured` (opcional): Filtrar productos destacados (`true`/`false`)
- `search` (opcional): Buscar en nombre y descripción

**Nota:** Puedes usar `categoryId` o `categorySlug`, pero no ambos. Si usas `categorySlug`, el backend buscará automáticamente el UUID correspondiente.

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Laptop HP",
      "slug": "laptop-hp",
      "description": "Laptop de alta gama",
      "price": "1299.99",
      "stock": 10,
      "is_featured": true,
      "category_id": "uuid",
      "created_at": "2024-12-01T00:00:00.000Z",
      "categories": {
        "id": "uuid",
        "name": "Electrónicos",
        "slug": "electronicos"
      },
      "product_images": [
        {
          "id": "uuid",
          "image_url": "https://..."
        }
      ],
      "variants": [
        {
          "id": "uuid",
          "name": "Color",
          "value": "Negro"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

**Ejemplo (PowerShell):**
```powershell
# Obtener primera página
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?page=1&limit=10"

# Filtrar por categoría (UUID)
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?categoryId=uuid-categoria"

# Filtrar por categoría (slug - recomendado para URLs amigables)
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?categorySlug=electronicos"

# Combinar filtros
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?categorySlug=electronicos&isFeatured=true&page=1"

# Buscar productos
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?search=laptop"

# Productos destacados
$products = Invoke-RestMethod -Uri "http://localhost:3000/api/products?isFeatured=true"
```

---

### GET /api/products/{id}

Obtener un producto por ID.

**Autenticación:** No requerida (público)

**Path Parameters:**
- `id`: UUID del producto

**Response 200 OK:**
```json
{
  "id": "uuid",
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "description": "Laptop de alta gama",
  "price": "1299.99",
  "stock": 10,
  "is_featured": true,
  "category_id": "uuid",
  "created_at": "2024-12-01T00:00:00.000Z",
  "categories": {
    "id": "uuid",
    "name": "Electrónicos",
    "slug": "electronicos"
  },
  "product_images": [
    {
      "id": "uuid",
      "image_url": "https://..."
    }
  ],
  "variants": [
    {
      "id": "uuid",
      "name": "Color",
      "value": "Negro"
    }
  ]
}
```

**Response 400 Bad Request:**
```json
{
  "error": "ID inválido",
  "details": [
    {
      "path": [],
      "message": "El ID debe ser un UUID válido"
    }
  ]
}
```

**Response 404 Not Found:**
```json
{
  "error": "Producto no encontrado"
}
```

**Ejemplo (PowerShell):**
```powershell
$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products/uuid-producto"
```

---

### POST /api/products

Crear un nuevo producto.

**Autenticación:** Requerida (Bearer Token)

**Request Body:**
```json
{
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "description": "Laptop de alta gama",
  "price": "1299.99",
  "stock": 10,
  "isFeatured": false,
  "categoryId": "uuid-categoria",
  "variants": [
    {
      "name": "Color",
      "value": "Negro"
    },
    {
      "name": "Talla",
      "value": "15 pulgadas"
    }
  ],
  "images": [
    {
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}
```

**Validaciones:**
- `name`: String, 1-255 caracteres, requerido
- `slug`: String, 1-255 caracteres, formato: `a-z0-9-`, requerido
- `description`: String, máximo 5000 caracteres, opcional
- `price`: String o Number, positivo, requerido
- `stock`: Number, entero, mínimo 0, default: 0
- `isFeatured`: Boolean, default: false
- `categoryId`: UUID válido, opcional
- `variants`: Array de objetos con `name` y `value`, opcional
- `images`: Array de objetos con `imageUrl`, opcional

**Response 201 Created:**
```json
{
  "id": "uuid",
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "description": "Laptop de alta gama",
  "price": "1299.99",
  "stock": 10,
  "is_featured": false,
  "category_id": "uuid-categoria",
  "created_at": "2024-12-01T00:00:00.000Z",
  "categories": {
    "id": "uuid-categoria",
    "name": "Electrónicos",
    "slug": "electronicos"
  },
  "product_images": [
    {
      "id": "uuid",
      "image_url": "https://example.com/image.jpg"
    }
  ],
  "variants": [
    {
      "id": "uuid",
      "name": "Color",
      "value": "Negro"
    }
  ]
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["price"],
      "message": "El precio debe ser un número válido (ej: 99.99)"
    }
  ]
}
```

**Ejemplo (PowerShell):**
```powershell
$body = @{
  name = "Laptop HP"
  slug = "laptop-hp"
  description = "Laptop de alta gama"
  price = "1299.99"
  stock = 10
  isFeatured = $false
  categoryId = "uuid-categoria"
  variants = @(
    @{ name = "Color"; value = "Negro" }
  )
  images = @(
    @{ imageUrl = "https://example.com/image.jpg" }
  )
} | ConvertTo-Json -Depth 10

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" `
  -Method POST `
  -Body $body `
  -Headers $headers
```

---

### PUT /api/products/{id}

Actualizar un producto existente.

**Autenticación:** Requerida (Bearer Token)

**Path Parameters:**
- `id`: UUID del producto

**Request Body:**
```json
{
  "name": "Laptop HP Actualizada",
  "price": "1199.99",
  "stock": 15,
  "variants": [
    {
      "name": "Color",
      "value": "Blanco"
    }
  ]
}
```

**Nota:** Todos los campos son opcionales. Solo se actualizarán los campos proporcionados.

**Response 200 OK:**
```json
{
  "id": "uuid",
  "name": "Laptop HP Actualizada",
  "slug": "laptop-hp",
  "description": "Laptop de alta gama",
  "price": "1199.99",
  "stock": 15,
  "is_featured": false,
  "category_id": "uuid-categoria",
  "created_at": "2024-12-01T00:00:00.000Z",
  "categories": {
    "id": "uuid-categoria",
    "name": "Electrónicos",
    "slug": "electronicos"
  },
  "product_images": [...],
  "variants": [
    {
      "id": "uuid",
      "name": "Color",
      "value": "Blanco"
    }
  ]
}
```

**Response 404 Not Found:**
```json
{
  "error": "Producto no encontrado"
}
```

**Ejemplo (PowerShell):**
```powershell
$body = @{
  price = "1199.99"
  stock = 15
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products/uuid-producto" `
  -Method PUT `
  -Body $body `
  -Headers $headers
```

---

### DELETE /api/products/{id}

Eliminar un producto.

**Autenticación:** Requerida (Bearer Token)

**Path Parameters:**
- `id`: UUID del producto

**Nota:** Las imágenes y variantes relacionadas se eliminan automáticamente (cascade).

**Response 200 OK:**
```json
{
  "message": "Producto eliminado correctamente"
}
```

**Response 404 Not Found:**
```json
{
  "error": "Producto no encontrado"
}
```

**Ejemplo (PowerShell):**
```powershell
$headers = @{
  "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/products/uuid-producto" `
  -Method DELETE `
  -Headers $headers
```

---

## 📤 Upload de Imágenes

### POST /api/upload

Subir una imagen a Supabase Storage.

**Autenticación:** Requerida (Bearer Token)

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Archivo de imagen (requerido)

**Validaciones:**
- Tipo de archivo: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`
- Tamaño máximo: 5MB

**Response 201 Created:**
```json
{
  "success": true,
  "file": {
    "id": "products/1234567890-abc123.jpg",
    "fileName": "1234567890-abc123.jpg",
    "filePath": "products/1234567890-abc123.jpg",
    "url": "https://supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg",
    "size": 102400,
    "type": "image/jpeg"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Tipo de archivo no permitido",
  "details": "Solo se permiten imágenes: JPEG, PNG, WebP, GIF"
}
```

```json
{
  "error": "Archivo demasiado grande",
  "details": "El archivo no puede ser mayor a 5MB"
}
```

**Ejemplo (PowerShell):**
```powershell
$filePath = "C:\ruta\a\imagen.jpg"
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = (
  "--$boundary",
  "Content-Disposition: form-data; name=`"file`"; filename=`"imagen.jpg`"",
  "Content-Type: image/jpeg",
  "",
  [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
  "--$boundary--"
) -join $LF

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "multipart/form-data; boundary=$boundary"
}

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" `
  -Method POST `
  -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($bodyLines)) `
  -Headers $headers

$imageUrl = $response.file.url
```

---

### GET /api/upload

Listar archivos subidos (para debugging).

**Autenticación:** Requerida (Bearer Token)

**Response 200 OK:**
```json
{
  "files": [
    {
      "name": "1234567890-abc123.jpg",
      "id": "uuid",
      "updated_at": "2024-12-01T00:00:00.000Z",
      "created_at": "2024-12-01T00:00:00.000Z",
      "last_accessed_at": "2024-12-01T00:00:00.000Z",
      "metadata": {},
      "url": "https://supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg"
    }
  ],
  "count": 1
}
```

**Ejemplo (PowerShell):**
```powershell
$headers = @{
  "Authorization" = "Bearer $token"
}

$files = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" `
  -Method GET `
  -Headers $headers
```

---

### DELETE /api/upload/{id}

Eliminar una imagen de Supabase Storage.

**Autenticación:** Requerida (Bearer Token)

**Path Parameters:**
- `id`: FilePath del archivo (ej: `products/1234567890-abc123.jpg`)

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Archivo eliminado correctamente",
  "filePath": "products/1234567890-abc123.jpg"
}
```

**Response 400 Bad Request:**
```json
{
  "error": "ID del archivo no proporcionado"
}
```

**Ejemplo (PowerShell):**
```powershell
$filePath = "products/1234567890-abc123.jpg"
$headers = @{
  "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/upload/$filePath" `
  -Method DELETE `
  -Headers $headers
```

---

## 📊 Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Datos inválidos o faltantes |
| 401 | Unauthorized - Token inválido o faltante |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## ⚠️ Manejo de Errores

Todos los errores siguen un formato consistente:

### Error de Validación (400)
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["campo"],
      "message": "Mensaje de error específico"
    }
  ]
}
```

### Error de Autenticación (401)
```json
{
  "error": "No autorizado"
}
```

### Error de Recurso No Encontrado (404)
```json
{
  "error": "Recurso no encontrado"
}
```

### Error del Servidor (500)
```json
{
  "error": "Mensaje de error",
  "details": "Detalles adicionales (opcional)",
  "type": "unexpected_error"
}
```

---

## 🔄 Flujo Completo de Ejemplo

### 1. Login
```powershell
$loginBody = @{
  email = "admin@example.com"
  password = "password123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -Body $loginBody `
  -ContentType "application/json"

$token = $login.session.access_token
```

### 2. Subir Imagen
```powershell
# (Ver ejemplo de POST /api/upload arriba)
$imageUrl = $response.file.url
```

### 3. Crear Producto con Imagen
```powershell
$productBody = @{
  name = "Producto Nuevo"
  slug = "producto-nuevo"
  price = "99.99"
  stock = 10
  images = @(
    @{ imageUrl = $imageUrl }
  )
} | ConvertTo-Json -Depth 10

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" `
  -Method POST `
  -Body $productBody `
  -Headers $headers
```

---

## 📝 Notas Importantes

1. **Autenticación:** La mayoría de los endpoints requieren Bearer Token. Obtén el token mediante `/api/auth/login`.

2. **UUIDs:** Todos los IDs son UUIDs v4. Asegúrate de usar el formato correcto.

3. **Slugs:** Los slugs deben seguir el formato `a-z0-9-` (solo letras minúsculas, números y guiones).

4. **Precios:** Los precios pueden enviarse como string o number. Internamente se almacenan como string.

5. **Imágenes:** Las imágenes se suben a Supabase Storage. El endpoint retorna la URL pública que puedes usar en productos.

6. **Cascada:** Al eliminar un producto, sus imágenes y variantes se eliminan automáticamente.

---

## 🔗 Enlaces Útiles

- [Validaciones Zod](./VALIDACIONES_ZOD.md) - Documentación de esquemas de validación
- [Estado del Proyecto](./ESTADO_PROYECTO.md) - Estado actual del proyecto
- [OpenAPI Specification](./openapi.json) - Especificación OpenAPI 3.0

---

**Última actualización:** Diciembre 2024  
**Versión de la API:** 1.0.0

