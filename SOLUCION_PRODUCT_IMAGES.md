# 🔧 Solución: Manejo de `product_images` en Productos

## 📋 Problema Identificado

El frontend estaba enviando `product_images` en el body, pero el backend esperaba `images`. Además, había inconsistencias en el formato de los datos de imágenes.

## ✅ Solución Implementada

### 1. **Compatibilidad con Ambos Formatos**

El backend ahora acepta **ambos formatos** para máxima compatibilidad:

#### Formato 1: `images` (recomendado)
```json
{
  "name": "Producto",
  "images": [
    { "imageUrl": "https://..." }
  ]
}
```

#### Formato 2: `product_images` (también soportado)
```json
{
  "name": "Producto",
  "product_images": [
    { "imageUrl": "https://..." }
  ]
}
```

### 2. **Normalización Automática**

El esquema de validación Zod ahora:
- Acepta tanto `images` como `product_images`
- Normaliza automáticamente `product_images` a `images` internamente
- Mantiene compatibilidad con ambos formatos

### 3. **Soporte para Múltiples Formatos de URL**

El backend acepta imágenes con:
- `imageUrl` (camelCase) ✅
- `image_url` (snake_case) ✅

```json
// Ambos funcionan:
{ "imageUrl": "https://..." }
{ "image_url": "https://..." }
```

## 📝 Endpoints Actualizados

### POST /api/products

**Request Body:**
```json
{
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "price": "1299.99",
  "stock": 10,
  "images": [
    { "imageUrl": "https://supabase.co/storage/.../image1.jpg" },
    { "imageUrl": "https://supabase.co/storage/.../image2.jpg" }
  ],
  "variants": [
    { "name": "Color", "value": "Negro" }
  ]
}
```

**O también:**
```json
{
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "price": "1299.99",
  "product_images": [
    { "imageUrl": "https://supabase.co/storage/.../image1.jpg" }
  ]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "price": "1299.99",
  "stock": 10,
  "product_images": [
    {
      "id": "uuid",
      "image_url": "https://supabase.co/storage/.../image1.jpg"
    },
    {
      "id": "uuid",
      "image_url": "https://supabase.co/storage/.../image2.jpg"
    }
  ],
  "variants": [...],
  "categories": {...}
}
```

### PUT /api/products/{id}

**Request Body:**
```json
{
  "price": "1199.99",
  "images": [
    { "imageUrl": "https://supabase.co/storage/.../new-image.jpg" }
  ]
}
```

**Comportamiento:**
- Si se envía `images`, **reemplaza todas las imágenes existentes** con las nuevas
- Si se envía `images: []` (array vacío), **elimina todas las imágenes**
- Si no se envía `images`, **mantiene las imágenes existentes**

## 🔍 Mejoras en Manejo de Errores

### Errores Específicos

1. **Error al insertar imágenes:**
```json
{
  "error": "Error al insertar imágenes",
  "details": "Mensaje de error específico",
  "code": "Código de error de Supabase",
  "hint": "Sugerencia para resolver el error"
}
```

2. **Imagen sin URL:**
```json
{
  "error": "Cada imagen debe tener 'imageUrl' o 'image_url'"
}
```

3. **Validación de datos:**
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["images", 0, "imageUrl"],
      "message": "La URL de la imagen debe ser válida"
    }
  ]
}
```

## 📚 Ejemplos de Uso

### Crear Producto con Imágenes

```typescript
// Opción 1: Usando 'images'
const product = await api.createProduct({
  name: "Laptop HP",
  slug: "laptop-hp",
  price: "1299.99",
  images: [
    { imageUrl: "https://supabase.co/storage/.../image1.jpg" }
  ]
});

// Opción 2: Usando 'product_images' (también funciona)
const product2 = await api.createProduct({
  name: "Laptop HP",
  slug: "laptop-hp",
  price: "1299.99",
  product_images: [
    { imageUrl: "https://supabase.co/storage/.../image1.jpg" }
  ]
});
```

### Actualizar Imágenes de un Producto

```typescript
// Reemplazar todas las imágenes
await api.updateProduct(productId, {
  images: [
    { imageUrl: "https://supabase.co/storage/.../new-image1.jpg" },
    { imageUrl: "https://supabase.co/storage/.../new-image2.jpg" }
  ]
});

// Eliminar todas las imágenes
await api.updateProduct(productId, {
  images: []
});
```

### Flujo Completo: Subir Imagen y Crear Producto

```typescript
// 1. Subir imagen
const uploadResult = await api.uploadImage(file);
const imageUrl = uploadResult.file.url;

// 2. Crear producto con la imagen
const product = await api.createProduct({
  name: "Nuevo Producto",
  slug: "nuevo-producto",
  price: "99.99",
  images: [
    { imageUrl: imageUrl }
  ]
});

// 3. El producto ya incluye las imágenes en la respuesta
console.log(product.product_images); // Array con las imágenes
```

## ⚠️ Notas Importantes

1. **Formato de Respuesta:**
   - El backend siempre devuelve `product_images` (snake_case) en las respuestas
   - El frontend puede enviar `images` o `product_images` (ambos funcionan)

2. **Actualización de Imágenes:**
   - Al actualizar, si envías `images`, **reemplaza todas** las imágenes existentes
   - Si quieres agregar imágenes sin eliminar las existentes, primero obtén el producto, combina las imágenes y luego actualiza

3. **Validaciones:**
   - Cada imagen debe tener una URL válida
   - La URL debe ser un string válido (validado con Zod)
   - Máximo 2048 caracteres por URL

4. **Transacciones:**
   - Si falla la inserción de imágenes, el producto se elimina automáticamente (rollback)
   - Esto asegura consistencia de datos

## 🔗 Archivos Modificados

- `src/validations/product.ts` - Esquemas de validación actualizados
- `src/app/api/products/route.ts` - Lógica de creación mejorada
- `src/app/api/products/[id]/route.ts` - Lógica de actualización mejorada

## ✅ Testing

Para probar que todo funciona:

```bash
# 1. Crear producto con imágenes
curl -X POST https://portal-admin-black.vercel.app/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "slug": "test-product",
    "price": "99.99",
    "images": [
      { "imageUrl": "https://example.com/image.jpg" }
    ]
  }'

# 2. Verificar que las imágenes se crearon
curl https://portal-admin-black.vercel.app/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Implementado y probado










