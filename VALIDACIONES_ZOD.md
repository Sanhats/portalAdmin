# ✅ Validaciones con Zod - Documentación Completa

**Estado:** ✅ **TODOS LOS ESQUEMAS IMPLEMENTADOS**  
**Fecha:** Diciembre 2024

---

## 📋 Esquemas Implementados

### 1. ✅ `productSchema` y Esquemas Relacionados

**Archivo:** `src/validations/product.ts`

#### `productSchema`
Esquema base para productos:

```typescript
{
  name: string (1-255 caracteres, requerido)
  slug: string (1-255 caracteres, formato: a-z0-9-, requerido)
  description: string (máx 5000 caracteres, opcional)
  price: string | number (positivo, requerido)
  stock: number (entero, mínimo 0, default 0)
  isFeatured: boolean (default false)
  categoryId: string (UUID válido, opcional)
}
```

#### `variantSchema`
Esquema para variantes de productos:

```typescript
{
  name: string (1-100 caracteres, requerido)
  value: string (1-100 caracteres, requerido)
}
```

#### `productImageSchema`
Esquema para imágenes de productos:

```typescript
{
  imageUrl: string (URL válida, máx 2048 caracteres, requerido)
}
```

#### `createProductSchema`
Esquema completo para crear producto:

```typescript
productSchema + {
  variants: variantSchema[] (opcional, default [])
  images: productImageSchema[] (opcional, default [])
}
```

#### `updateProductSchema`
Esquema para actualizar producto (todos los campos opcionales):

```typescript
productSchema.partial() + {
  variants: variantSchema[] (opcional)
  images: productImageSchema[] (opcional)
}
```

---

### 2. ✅ `categorySchema` y Esquemas Relacionados

**Archivo:** `src/validations/category.ts`

#### `categorySchema`
Esquema base para categorías:

```typescript
{
  name: string (1-255 caracteres, requerido)
  slug: string (1-255 caracteres, formato: a-z0-9-, requerido)
}
```

#### `categoryUpdateSchema`
Esquema para actualización parcial:

```typescript
categorySchema.partial()
```

#### `createCategorySchema`
Esquema para crear categoría (igual que categorySchema):

```typescript
categorySchema
```

#### `updateCategorySchema`
Esquema para actualizar categoría:

```typescript
categoryUpdateSchema
```

---

### 3. ✅ `uploadSchema` y Esquemas Relacionados

**Archivo:** `src/validations/upload.ts`

#### `fileNameSchema`
Validación para nombres de archivo:

```typescript
string (1-255 caracteres)
```

#### `imageFileTypeSchema`
Validación para tipos de archivo permitidos:

```typescript
enum: "image/jpeg" | "image/jpg" | "image/png" | "image/webp" | "image/gif"
```

#### `fileSizeSchema`
Validación para tamaño de archivo:

```typescript
number (máximo 5MB)
```

#### `imageUploadSchema`
Esquema para upload de imagen:

```typescript
{
  file: File (requerido)
  fileName: string (opcional)
}
```

#### `multipleImageUploadSchema`
Esquema para múltiples archivos:

```typescript
{
  files: File[] (mínimo 1 archivo, requerido)
}
```

---

### 4. ✅ `authSchema` y Esquemas Relacionados

**Archivo:** `src/validations/auth.ts`

#### `loginSchema`
Esquema para login:

```typescript
{
  email: string (email válido, 1-255 caracteres, requerido)
  password: string (6-100 caracteres, requerido)
}
```

#### `registerSchema`
Esquema para registro (futuro):

```typescript
{
  email: string (email válido, requerido)
  password: string (6-100 caracteres, con mayúscula, minúscula, número)
  confirmPassword: string (debe coincidir con password)
}
```

#### `changePasswordSchema`
Esquema para cambio de contraseña (futuro):

```typescript
{
  currentPassword: string (requerido)
  newPassword: string (6-100 caracteres, con mayúscula, minúscula, número)
}
```

---

## 📁 Estructura de Archivos

```
src/validations/
 ├─ product.ts      ✅ Esquemas de productos
 ├─ category.ts     ✅ Esquemas de categorías
 ├─ upload.ts       ✅ Esquemas de upload
 └─ auth.ts         ✅ Esquemas de autenticación
```

---

## 🔍 Validaciones Implementadas

### Productos

| Campo | Validación | Mensaje de Error |
|-------|------------|------------------|
| `name` | 1-255 caracteres | "El nombre es requerido" / "El nombre no puede exceder 255 caracteres" |
| `slug` | 1-255 caracteres, formato a-z0-9- | "El slug es requerido" / "El slug debe contener solo letras minúsculas, números y guiones" |
| `description` | Máx 5000 caracteres | "La descripción no puede exceder 5000 caracteres" |
| `price` | String o Number positivo | "El precio es requerido" / "El precio debe ser un número válido" |
| `stock` | Entero, mínimo 0 | "El stock debe ser un número entero" / "El stock no puede ser negativo" |
| `isFeatured` | Boolean | Default: false |
| `categoryId` | UUID válido | "El categoryId debe ser un UUID válido" |

### Categorías

| Campo | Validación | Mensaje de Error |
|-------|------------|------------------|
| `name` | 1-255 caracteres | "El nombre es requerido" / "El nombre no puede exceder 255 caracteres" |
| `slug` | 1-255 caracteres, formato a-z0-9- | "El slug es requerido" / "El slug debe contener solo letras minúsculas, números y guiones" |

### Upload

| Validación | Límite | Mensaje de Error |
|------------|--------|------------------|
| Tipo de archivo | JPEG, PNG, WebP, GIF | "Tipo de archivo no permitido" |
| Tamaño máximo | 5MB | "El archivo no puede ser mayor a 5MB" |
| Nombre de archivo | 1-255 caracteres | Validación automática |

### Autenticación

| Campo | Validación | Mensaje de Error |
|-------|------------|------------------|
| `email` | Email válido, 1-255 caracteres | "Email inválido" |
| `password` | 6-100 caracteres | "La contraseña debe tener al menos 6 caracteres" |

---

## 💻 Uso en Endpoints

### Ejemplo: Crear Producto

```typescript
import { createProductSchema } from "@/validations/product";

const body = await req.json();
const parsed = createProductSchema.safeParse(body);

if (!parsed.success) {
  return Response.json(
    { error: "Datos inválidos", details: parsed.error.errors },
    { status: 400 }
  );
}

// parsed.data contiene los datos validados
```

### Ejemplo: Crear Categoría

```typescript
import { createCategorySchema } from "@/validations/category";

const body = await req.json();
const parsed = createCategorySchema.safeParse(body);

if (!parsed.success) {
  return Response.json(
    { error: "Datos inválidos", details: parsed.error.errors },
    { status: 400 }
  );
}
```

### Ejemplo: Login

```typescript
import { loginSchema } from "@/validations/auth";

const body = await req.json();
const parsed = loginSchema.safeParse(body);

if (!parsed.success) {
  return Response.json(
    { error: "Datos inválidos", details: parsed.error.errors },
    { status: 400 }
  );
}
```

---

## 📝 Mensajes de Error

Todos los esquemas retornan mensajes de error descriptivos en español:

```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["name"],
      "message": "El nombre es requerido"
    },
    {
      "path": ["price"],
      "message": "El precio debe ser un número válido (ej: 99.99)"
    }
  ]
}
```

---

## ✅ Beneficios de las Validaciones

1. **Consistencia:** Todos los endpoints usan los mismos esquemas
2. **Seguridad:** Validación de tipos y formatos antes de procesar
3. **Mensajes claros:** Errores descriptivos en español
4. **Mantenibilidad:** Cambios centralizados en un solo lugar
5. **Type Safety:** TypeScript infiere tipos desde los esquemas

---

## 🔄 Actualizar Validaciones

Para modificar una validación:

1. Edita el archivo correspondiente en `src/validations/`
2. Los cambios se aplican automáticamente a todos los endpoints que usan ese esquema
3. No necesitas modificar cada endpoint individualmente

**Ejemplo:** Cambiar el límite de caracteres del nombre de producto:

```typescript
// src/validations/product.ts
name: z.string()
  .min(1, "El nombre es requerido")
  .max(500, "El nombre no puede exceder 500 caracteres") // Cambiado de 255 a 500
```

---

## 📚 Referencias

- [Zod Documentation](https://zod.dev/)
- [Zod TypeScript Integration](https://zod.dev/?id=typescript)

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Todos los esquemas implementados y funcionando

