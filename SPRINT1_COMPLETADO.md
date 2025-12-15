# ✅ SPRINT 1 — Core de Producto (Fundación) - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Tener el modelo base de producto y poder crear uno manualmente.

---

## ✅ Entregables Completados

### 1. **Tabla `products` actualizada**

La tabla ahora incluye los campos mínimos requeridos:

```sql
products {
  id              UUID (PK, auto-generado)
  sku             TEXT (UNIQUE, NOT NULL)
  name_internal   TEXT (NOT NULL)
  price           NUMERIC (NOT NULL)
  stock           INTEGER (default: 0)
  category_id     UUID (FK a categories, nullable)
  is_active       BOOLEAN (default: true)
  is_visible      BOOLEAN (default: true)
  created_at      TIMESTAMP (auto-generado)
}
```

**Nota:** Los campos antiguos (`name`, `slug`, `description`, `is_featured`) se mantienen como opcionales para compatibilidad futura.

---

### 2. **Validaciones base implementadas**

Archivo: `src/validations/product-sprint1.ts`

- ✅ Validación de `sku`: Requerido, único, formato alfanumérico (mayúsculas, números, guiones, guiones bajos)
- ✅ Validación de `name_internal`: Requerido, máximo 255 caracteres
- ✅ Validación de `price`: Requerido, número positivo (string o number)
- ✅ Validación de `stock`: Entero no negativo, default 0
- ✅ Validación de `categoryId`: UUID válido, opcional
- ✅ Validación de `isActive`: Boolean, default true
- ✅ Validación de `isVisible`: Boolean, default true

---

### 3. **Endpoint POST /products implementado**

**Ruta:** `POST /api/products`

**Campos requeridos en el body:**
```json
{
  "sku": "PROD-001",
  "nameInternal": "Producto de prueba",
  "price": 15000,
  "stock": 50,
  "categoryId": "b85c7cd6-08d3-4f49-ac78-b97ecbda25bb",  // opcional
  "isActive": true,  // opcional, default: true
  "isVisible": true  // opcional, default: true
}
```

**Respuesta exitosa (201):**
```json
{
  "id": "9987429d-b2cd-4bf4-8d99-0e441e136e5d",
  "sku": "PROD-001",
  "name_internal": "Producto de prueba",
  "price": "15000",
  "stock": 50,
  "category_id": "b85c7cd6-08d3-4f49-ac78-b97ecbda25bb",
  "is_active": true,
  "is_visible": true,
  "created_at": "2024-12-XX...",
  "categories": {
    "id": "...",
    "name": "...",
    "slug": "..."
  }
}
```

**Errores posibles:**
- `400`: Datos inválidos (validación fallida)
- `500`: Error del servidor (problemas de BD, etc.)

---

## 📦 Campos Mínimos Implementados

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `id` | UUID | ✅ | Auto | Identificador único |
| `sku` | TEXT | ✅ | - | Código SKU único |
| `name_internal` | TEXT | ✅ | - | Nombre interno del producto |
| `price` | NUMERIC | ✅ | - | Precio del producto |
| `stock` | INTEGER | ✅ | 0 | Cantidad en stock |
| `category_id` | UUID | ❌ | null | Categoría del producto |
| `is_active` | BOOLEAN | ❌ | true | Si el producto está activo |
| `is_visible` | BOOLEAN | ❌ | true | Si el producto es visible |
| `created_at` | TIMESTAMP | ✅ | Auto | Fecha de creación |

---

## ✅ Criterio de Éxito

- ✅ **Se puede crear un producto válido con pocos datos**
  - Solo requiere: `sku`, `nameInternal`, `price`
  - Los demás campos tienen valores por defecto o son opcionales

- ✅ **No depende del frontend**
  - Endpoint completamente funcional
  - Se puede probar con cualquier cliente HTTP (Postman, curl, PowerShell, etc.)

- ✅ **Preparado para extenderse**
  - Schema de Drizzle actualizado
  - Validaciones modulares
  - Campos antiguos mantenidos para compatibilidad

---

## 🚀 Próximos Pasos

Para usar el endpoint:

1. **Ejecutar migración SQL:**
   ```sql
   -- Ejecutar el script en Supabase SQL Editor:
   -- drizzle/migration_sprint1_products.sql
   ```

2. **Probar el endpoint:**
   ```bash
   # Ejemplo con curl
   curl -X POST http://localhost:3000/api/products \
     -H "Content-Type: application/json" \
     -d '{
       "sku": "PROD-001",
       "nameInternal": "Producto de prueba",
       "price": 15000,
       "stock": 50
     }'
   ```

3. **O con PowerShell:**
   ```powershell
   $body = @{
       sku = "PROD-001"
       nameInternal = "Producto de prueba"
       price = 15000
       stock = 50
   } | ConvertTo-Json

   Invoke-RestMethod -Uri "http://localhost:3000/api/products" `
     -Method POST `
     -ContentType "application/json" `
     -Body $body
   ```

---

## 📝 Archivos Modificados/Creados

1. ✅ `src/db/schema.ts` - Schema actualizado con campos del SPRINT 1
2. ✅ `src/validations/product-sprint1.ts` - Validaciones mínimas (NUEVO)
3. ✅ `src/app/api/products/route.ts` - Endpoint POST actualizado
4. ✅ `drizzle/migration_sprint1_products.sql` - Script de migración SQL (NUEVO)

---

## ⚠️ Notas Importantes

1. **Migración de datos existentes:**
   - Si ya hay productos en la tabla, necesitas migrar los datos antes de hacer `sku` y `name_internal` NOT NULL
   - Ver instrucciones en `drizzle/migration_sprint1_products.sql`

2. **Campos opcionales mantenidos:**
   - Los campos `name`, `slug`, `description`, `is_featured` se mantienen en la tabla pero NO son requeridos en el SPRINT 1
   - Esto permite extender el modelo en sprints futuros sin romper compatibilidad

3. **Validación de SKU:**
   - El SKU debe ser único en la base de datos
   - Formato: Solo letras mayúsculas, números, guiones y guiones bajos
   - Ejemplo válido: `PROD-001`, `SKU_ABC123`, `ITEM-2024-001`

---

## 🎉 Estado Final

**SPRINT 1 COMPLETADO** ✅

El endpoint `POST /api/products` está listo para crear productos con los campos mínimos requeridos.

