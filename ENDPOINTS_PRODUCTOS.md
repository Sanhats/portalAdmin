# 🛍️ Endpoints CRUD de Productos - Documentación

**Estado:** ✅ Implementado completamente  
**Fecha:** Diciembre 2024

---

## 📋 Endpoints Implementados

### 1. GET /api/products
**Listar productos con filtros, paginación e includes**

#### Query Parameters:
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Productos por página (default: 10)
- `categoryId` (opcional): Filtrar por categoría (UUID)
- `isFeatured` (opcional): Filtrar productos destacados (`true`/`false`)
- `search` (opcional): Búsqueda en nombre y descripción

#### Respuesta Exitosa (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Producto ejemplo",
      "slug": "producto-ejemplo",
      "description": "Descripción del producto",
      "price": "99.99",
      "stock": 10,
      "is_featured": true,
      "category_id": "uuid",
      "created_at": "2024-12-01T00:00:00Z",
      "categories": {
        "id": "uuid",
        "name": "Categoría",
        "slug": "categoria"
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
          "name": "Talla",
          "value": "M"
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

#### Ejemplos de Uso:
```bash
# Obtener todos los productos
GET /api/products

# Paginación
GET /api/products?page=2&limit=20

# Filtrar por categoría
GET /api/products?categoryId=uuid-de-categoria

# Productos destacados
GET /api/products?isFeatured=true

# Búsqueda
GET /api/products?search=laptop

# Combinar filtros
GET /api/products?categoryId=uuid&isFeatured=true&page=1&limit=10
```

---

### 2. GET /api/products/[id]
**Obtener producto por ID con expansión completa**

#### Parámetros:
- `id` (path): UUID del producto

#### Respuesta Exitosa (200):
```json
{
  "id": "uuid",
  "name": "Producto ejemplo",
  "slug": "producto-ejemplo",
  "description": "Descripción completa",
  "price": "99.99",
  "stock": 10,
  "is_featured": true,
  "category_id": "uuid",
  "created_at": "2024-12-01T00:00:00Z",
  "categories": {
    "id": "uuid",
    "name": "Categoría",
    "slug": "categoria"
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
      "name": "Talla",
      "value": "M"
    },
    {
      "id": "uuid",
      "name": "Color",
      "value": "Rojo"
    }
  ]
}
```

#### Errores:
- `400`: ID inválido (no es UUID)
- `404`: Producto no encontrado
- `500`: Error del servidor

#### Ejemplo de Uso:
```bash
GET /api/products/123e4567-e89b-12d3-a456-426614174000
```

---

### 3. POST /api/products
**Crear nuevo producto con variantes e imágenes**

#### Body (JSON):
```json
{
  "name": "Nuevo Producto",
  "slug": "nuevo-producto",
  "description": "Descripción del producto",
  "price": "99.99",
  "stock": 10,
  "isFeatured": false,
  "categoryId": "uuid-de-categoria",
  "variants": [
    {
      "name": "Talla",
      "value": "M"
    },
    {
      "name": "Color",
      "value": "Rojo"
    }
  ],
  "images": [
    {
      "imageUrl": "https://ejemplo.com/imagen1.jpg"
    },
    {
      "imageUrl": "https://ejemplo.com/imagen2.jpg"
    }
  ]
}
```

#### Campos Requeridos:
- `name`: string (mínimo 1 carácter)
- `slug`: string (mínimo 1 carácter)
- `price`: string o number (positivo)

#### Campos Opcionales:
- `description`: string | null
- `stock`: number (default: 0, mínimo: 0)
- `isFeatured`: boolean (default: false)
- `categoryId`: UUID | null
- `variants`: array de objetos `{ name: string, value: string }`
- `images`: array de objetos `{ imageUrl: string }`

#### Respuesta Exitosa (201):
Retorna el producto creado con todas sus relaciones.

#### Errores:
- `400`: Datos inválidos (validación Zod fallida)
- `500`: Error del servidor

#### Ejemplo de Uso:
```bash
POST /api/products
Content-Type: application/json

{
  "name": "Laptop Gaming",
  "slug": "laptop-gaming",
  "description": "Potente laptop para gaming",
  "price": "1299.99",
  "stock": 5,
  "isFeatured": true,
  "categoryId": "uuid-de-electronicos",
  "variants": [
    { "name": "RAM", "value": "16GB" },
    { "name": "Almacenamiento", "value": "512GB SSD" }
  ],
  "images": [
    { "imageUrl": "https://ejemplo.com/laptop1.jpg" }
  ]
}
```

---

### 4. PUT /api/products/[id]
**Actualizar producto (actualización parcial)**

#### Parámetros:
- `id` (path): UUID del producto

#### Body (JSON):
Todos los campos son opcionales (actualización parcial):
```json
{
  "name": "Nombre actualizado",
  "price": "89.99",
  "stock": 15,
  "isFeatured": true,
  "variants": [
    {
      "name": "Talla",
      "value": "L"
    }
  ],
  "images": [
    {
      "imageUrl": "https://ejemplo.com/nueva-imagen.jpg"
    }
  ]
}
```

#### Notas Importantes:
- **Variantes**: Si se envía `variants`, se reemplazan TODAS las variantes existentes
- **Imágenes**: Si se envía `images`, se reemplazan TODAS las imágenes existentes
- **Precio**: Puede ser string o number
- **categoryId**: Puede ser `null` para desasociar de categoría

#### Respuesta Exitosa (200):
Retorna el producto actualizado con todas sus relaciones.

#### Errores:
- `400`: ID inválido o datos inválidos
- `404`: Producto no encontrado
- `500`: Error del servidor

#### Ejemplo de Uso:
```bash
PUT /api/products/123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json

{
  "price": "79.99",
  "stock": 20
}
```

---

### 5. DELETE /api/products/[id]
**Eliminar producto (con cascada automática)**

#### Parámetros:
- `id` (path): UUID del producto

#### Respuesta Exitosa (200):
```json
{
  "message": "Producto eliminado correctamente"
}
```

#### Notas:
- Las **imágenes** relacionadas se eliminan automáticamente (cascade)
- Las **variantes** relacionadas se eliminan automáticamente (cascade)
- La operación es **irreversible**

#### Errores:
- `400`: ID inválido (no es UUID)
- `404`: Producto no encontrado
- `500`: Error del servidor

#### Ejemplo de Uso:
```bash
DELETE /api/products/123e4567-e89b-12d3-a456-426614174000
```

---

## 🔍 Validaciones Implementadas

### Esquemas Zod (`src/validations/product.ts`)

1. **productSchema**: Validación para crear producto
2. **productUpdateSchema**: Validación parcial para actualizar
3. **variantSchema**: Validación para variantes
4. **productImageSchema**: Validación para imágenes
5. **createProductSchema**: Esquema completo con variantes e imágenes
6. **updateProductSchema**: Esquema de actualización con variantes e imágenes

### Validaciones de UUID
- Todos los endpoints que reciben ID validan que sea un UUID válido
- Retorna error 400 si el formato es inválido

---

## 📁 Archivos Creados

1. **`src/validations/product.ts`**
   - Esquemas de validación Zod para productos

2. **`src/app/api/products/route.ts`**
   - GET /api/products (listar con filtros)
   - POST /api/products (crear)

3. **`src/app/api/products/[id]/route.ts`**
   - GET /api/products/[id] (obtener por ID)
   - PUT /api/products/[id] (actualizar)
   - DELETE /api/products/[id] (eliminar)

---

## 🧪 Pruebas Rápidas

### 1. Crear un producto de prueba:
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Producto Test",
    "slug": "producto-test",
    "price": "50.00",
    "stock": 10,
    "variants": [
      {"name": "Talla", "value": "M"}
    ],
    "images": [
      {"imageUrl": "https://ejemplo.com/test.jpg"}
    ]
  }'
```

### 2. Listar productos:
```bash
curl http://localhost:3000/api/products
```

### 3. Obtener producto por ID:
```bash
curl http://localhost:3000/api/products/[ID_DEL_PRODUCTO]
```

### 4. Actualizar producto:
```bash
curl -X PUT http://localhost:3000/api/products/[ID_DEL_PRODUCTO] \
  -H "Content-Type: application/json" \
  -d '{"price": "45.00", "stock": 15}'
```

### 5. Eliminar producto:
```bash
curl -X DELETE http://localhost:3000/api/products/[ID_DEL_PRODUCTO]
```

---

## ⚠️ Notas Importantes

1. **Precio como String**: Supabase almacena `price` como `numeric`, pero en las respuestas viene como string. Acepta tanto string como number en las requests.

2. **Reemplazo de Variantes/Imágenes**: 
   - En PUT, si envías `variants` o `images`, se reemplazan TODAS las existentes
   - Si quieres agregar sin reemplazar, primero obtén el producto, combina los arrays, y luego actualiza

3. **Cascada**: Las imágenes y variantes se eliminan automáticamente al eliminar un producto (configurado en el schema).

4. **Búsqueda**: La búsqueda usa `ilike` (case-insensitive) en los campos `name` y `description`.

5. **Paginación**: Por defecto muestra 10 productos por página. Ajusta con `limit`.

---

## 🎯 Próximos Pasos

Con estos endpoints completos, puedes:

1. ✅ **Panel Admin**: Crear, editar, listar y eliminar productos
2. ✅ **Frontend**: Mostrar catálogo con filtros y búsqueda
3. ✅ **API Pública**: Exponer productos con paginación

**Siguiente fase recomendada:**
- Sistema de upload de imágenes real (Supabase Storage)
- Autenticación y autorización
- Optimizaciones de rendimiento

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Completado y listo para usar

