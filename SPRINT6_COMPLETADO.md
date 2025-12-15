# ✅ SPRINT 6 — Normalización & Preparación SaaS - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Dejar el backend listo para escalar como SaaS multi-tenant con soft delete, índices optimizados y políticas RLS.

---

## ✅ Tareas Implementadas

### 1. **Multi-tenant Ready (store_id)**

#### **Tabla `stores` creada:**
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### **Cambios en tablas existentes:**
- ✅ `products.store_id` - Referencia a stores (multi-tenant)
- ✅ `categories.store_id` - Referencia a stores (multi-tenant)
- ✅ Store por defecto creado automáticamente para migración

#### **SKU único por store:**
- ✅ Constraint único global eliminado
- ✅ Índice único compuesto: `(store_id, sku)` donde `deleted_at IS NULL`
- ✅ Permite SKUs duplicados entre diferentes stores

#### **Endpoints actualizados:**
- ✅ `GET /api/products` - Filtro por `storeId` (query param)
- ✅ `POST /api/products` - Acepta `storeId` en body o header `x-store-id`
- ✅ Si no se proporciona `storeId`, usa store por defecto

---

### 2. **Soft Delete**

#### **Campo `deleted_at` agregado:**
- ✅ `products.deleted_at`
- ✅ `categories.deleted_at`
- ✅ `stores.deleted_at`

#### **Comportamiento:**
- ✅ Los registros no se eliminan físicamente
- ✅ Se marca `deleted_at = NOW()` al eliminar
- ✅ Todos los queries excluyen automáticamente registros eliminados
- ✅ Parámetro opcional `includeDeleted=true` para incluir eliminados

#### **Endpoints actualizados:**
- ✅ `GET /api/products` - Excluye eliminados por defecto
- ✅ `GET /api/products/:id` - Excluye eliminados
- ✅ `DELETE /api/products/:id` - Soft delete (marca `deleted_at`)
- ✅ `PATCH /api/products/:id` - No permite actualizar eliminados
- ✅ `PUT /api/products/:id` - No permite actualizar eliminados
- ✅ `PATCH /api/products/:id/stock` - No permite actualizar stock de eliminados

---

### 3. **Indexes (Índices para Performance)**

#### **Índices creados en `products`:**
```sql
-- Multi-tenant
CREATE INDEX products_store_id_idx ON products(store_id) WHERE deleted_at IS NULL;

-- Categorías
CREATE INDEX products_category_id_idx ON products(category_id) WHERE deleted_at IS NULL;

-- Filtros comunes
CREATE INDEX products_is_active_idx ON products(is_active) WHERE deleted_at IS NULL;
CREATE INDEX products_is_visible_idx ON products(is_visible) WHERE deleted_at IS NULL;

-- Ordenamiento
CREATE INDEX products_created_at_idx ON products(created_at DESC) WHERE deleted_at IS NULL;

-- Soft delete
CREATE INDEX products_deleted_at_idx ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- SKU único por store
CREATE UNIQUE INDEX products_store_sku_unique ON products(store_id, sku) WHERE deleted_at IS NULL;
```

#### **Índices creados en `categories`:**
```sql
CREATE INDEX categories_store_id_idx ON categories(store_id) WHERE deleted_at IS NULL;
CREATE INDEX categories_slug_idx ON categories(slug) WHERE deleted_at IS NULL;
```

#### **Índices en otras tablas:**
- ✅ `product_public_data.slug` - Para búsquedas por slug
- ✅ `stock_movements.product_id` - Para historial de stock
- ✅ `stock_movements.created_at` - Para consultas por fecha

---

### 4. **Policies (Supabase RLS)**

#### **RLS habilitado en:**
- ✅ `stores`
- ✅ `categories`
- ✅ `products`
- ✅ `product_public_data`
- ✅ `stock_movements`

#### **Políticas implementadas:**

**Lectura pública (SELECT):**
- ✅ Solo registros con `deleted_at IS NULL`
- ✅ Respetan multi-tenant (filtro por store_id)

**Escritura (INSERT/UPDATE/DELETE):**
- ✅ Solo usuarios autenticados (`auth.role() = 'authenticated'`)
- ✅ El backend usa `service_role_key` que bypasea RLS

#### **Nota importante:**
El backend usa `service_role_key` que bypasea RLS. Las políticas RLS protegen contra acceso directo desde el frontend sin autenticación. El middleware de Next.js valida tokens antes de que las requests lleguen a los endpoints.

---

## 📦 Estructura de Datos

### **Tabla `stores` (NUEVA):**
```typescript
{
  id: UUID (PK)
  name: TEXT (NOT NULL)
  slug: TEXT (NOT NULL, UNIQUE)
  created_at: TIMESTAMP (default: NOW())
  deleted_at: TIMESTAMP (nullable) // Soft delete
}
```

### **Tabla `products` (ACTUALIZADA):**
```typescript
{
  // ... campos existentes ...
  store_id: UUID (FK → stores.id, cascade delete) // SPRINT 6: Multi-tenant
  deleted_at: TIMESTAMP (nullable) // SPRINT 6: Soft delete
  // SKU ya no es único global, solo por store
}
```

### **Tabla `categories` (ACTUALIZADA):**
```typescript
{
  // ... campos existentes ...
  store_id: UUID (FK → stores.id, cascade delete) // SPRINT 6: Multi-tenant
  deleted_at: TIMESTAMP (nullable) // SPRINT 6: Soft delete
}
```

---

## 🔧 Cambios en Endpoints

### **GET /api/products**
**Nuevos query params:**
- `storeId` - Filtrar por store (multi-tenant)
- `includeDeleted` - Incluir productos eliminados (default: false)

**Ejemplo:**
```bash
GET /api/products?storeId=xxx&includeDeleted=false
```

### **POST /api/products**
**Nuevos campos:**
- `storeId` - En body o header `x-store-id`
- Si no se proporciona, usa store por defecto

**Ejemplo:**
```json
{
  "storeId": "xxx-xxx-xxx",
  "sku": "PROD-001",
  "nameInternal": "Producto",
  "price": 10000
}
```

### **DELETE /api/products/:id**
**Cambio:**
- Ahora hace **soft delete** (marca `deleted_at`)
- No elimina físicamente el registro

**Respuesta:**
```json
{
  "message": "Producto eliminado correctamente",
  "deletedAt": "2024-12-XX..."
}
```

---

## ✅ Criterio de Éxito

- ✅ **Multi-tenant ready**
  - Tabla `stores` creada
  - `store_id` agregado a productos y categorías
  - SKU único por store (no global)
  - Endpoints filtran por store

- ✅ **Soft delete**
  - Campo `deleted_at` en todas las tablas principales
  - DELETE hace soft delete
  - Queries excluyen eliminados por defecto
  - Opción para incluir eliminados

- ✅ **Indexes**
  - Índices en campos de filtrado comunes
  - Índices parciales (WHERE deleted_at IS NULL) para mejor performance
  - Índice único compuesto para SKU por store

- ✅ **Policies (RLS)**
  - RLS habilitado en todas las tablas
  - Políticas de lectura pública (solo no eliminados)
  - Políticas de escritura (solo autenticados)
  - Respetan multi-tenant y soft delete

---

## 📝 Migración SQL

**Archivo:** `drizzle/migration_sprint6_saas.sql`

**Pasos para aplicar:**
1. Ejecutar el script en Supabase SQL Editor
2. El script:
   - Crea tabla `stores`
   - Crea store por defecto
   - Agrega `store_id` y `deleted_at` a tablas existentes
   - Migra datos existentes al store por defecto
   - Crea todos los índices
   - Actualiza políticas RLS

**⚠️ IMPORTANTE:**
- Los productos existentes se migran al store por defecto
- El SKU único global se convierte en único por store
- Los registros existentes tienen `deleted_at = NULL`

---

## 🚀 Próximos Pasos

1. **Ejecutar migración SQL:**
   ```sql
   -- Ejecutar en Supabase SQL Editor:
   -- drizzle/migration_sprint6_saas.sql
   ```

2. **Probar multi-tenant:**
   - Crear productos con diferentes `storeId`
   - Verificar que SKUs pueden duplicarse entre stores
   - Verificar que filtros por store funcionan

3. **Probar soft delete:**
   - Eliminar un producto
   - Verificar que no aparece en GET /api/products
   - Verificar que aparece con `includeDeleted=true`
   - Verificar que no se puede actualizar un producto eliminado

---

## 🎉 Estado Final

**SPRINT 6 COMPLETADO** ✅

El backend ahora está:
- ✅ Listo para escalar como SaaS multi-tenant
- ✅ Con soft delete para recuperación de datos
- ✅ Con índices optimizados para performance
- ✅ Con políticas RLS para seguridad

---

## 📁 Archivos Creados/Modificados

1. ✅ `src/db/schema.ts` - Agregada tabla `stores`, campos `store_id` y `deleted_at`
2. ✅ `src/app/api/products/route.ts` - Filtros por store y soft delete
3. ✅ `src/app/api/products/[id]/route.ts` - Soft delete en DELETE, filtros en GET/PUT/PATCH
4. ✅ `src/app/api/products/[id]/stock/route.ts` - Filtro de eliminados
5. ✅ `drizzle/migration_sprint6_saas.sql` - Migración SQL completa (NUEVO)
6. ✅ `SPRINT6_COMPLETADO.md` - Documentación (NUEVO)

---

## 🔍 Notas Técnicas

### **Multi-tenant:**
- Cada store tiene sus propios productos y categorías
- SKU puede duplicarse entre stores
- Filtros automáticos por store en queries

### **Soft Delete:**
- Los registros eliminados se mantienen en la BD
- Permite recuperación de datos
- Mejora auditoría y trazabilidad

### **Performance:**
- Índices parciales (WHERE deleted_at IS NULL) mejoran queries
- Índices en campos de filtrado comunes
- Índice único compuesto para SKU por store

### **Seguridad:**
- RLS protege contra acceso directo sin autenticación
- Backend usa service_role_key (bypasea RLS)
- Middleware valida tokens antes de endpoints

