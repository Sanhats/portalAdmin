# ✅ SPRINT 1 — Núcleo Comercial: Productos, Listas de Precios, Stock

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el núcleo comercial del sistema dejando listo:

- ✅ Gestión de productos con campos completos
- ✅ Stock auditado y valorizado
- ✅ 4 listas de precios
- ✅ Reglas claras y centralizadas
- ✅ Endpoints estables y documentados

---

## 📋 Entregables Completados

### 1. **Modelo de Productos Actualizado**

La tabla `products` ahora incluye todos los campos requeridos:

```sql
products {
  id              UUID (PK, auto-generado)
  tenant_id       UUID (FK a stores, multi-tenant)
  name            TEXT (nombre del producto)
  sku             TEXT (único por tenant)
  barcode         TEXT (opcional, único por tenant)
  category_id     UUID (FK a categories, nullable)
  is_weighted     BOOLEAN (default: false)
  unit            TEXT (unit, kg, g - default: 'unit')
  cost            NUMERIC (costo actual, nullable)
  active          BOOLEAN (default: true)
  created_at      TIMESTAMP (auto-generado)
}
```

**Reglas implementadas:**
- ✅ El costo se usa para valorización y márgenes
- ✅ Productos inactivos no se pueden vender (validación en backend)
- ✅ Backend valida unicidad de SKU y barcode por tenant
- ✅ Validaciones con Zod

### 2. **Rubros (Categorías)**

CRUD básico ya implementado:
- ✅ `POST /api/categories` - Crear categoría
- ✅ `GET /api/categories` - Listar categorías
- ✅ `PUT /api/categories/:id` - Actualizar categoría
- ✅ `DELETE /api/categories/:id` - Eliminar categoría (soft delete)

**Relación con productos:**
- ✅ Cada producto puede tener una categoría
- ✅ Usado para reportes y aumento masivo de precios (preparado)

### 3. **Listas de Precios (4 listas fijas)**

Implementadas 4 listas de precios fijas:
- ✅ `price_list_1`
- ✅ `price_list_2`
- ✅ `price_list_3`
- ✅ `price_list_4`

**Modelo:**
```sql
product_prices {
  id              UUID (PK)
  product_id      UUID (FK a products)
  price_list_id   INTEGER (1-4)
  price           NUMERIC (15, 2)
  updated_at      TIMESTAMP
  UNIQUE(product_id, price_list_id)
}
```

**Reglas:**
- ✅ Cada producto puede tener hasta 4 precios
- ✅ El precio es independiente del costo
- ✅ No se calculan precios en frontend
- ✅ Estructura preparada para aumentos masivos

### 4. **Stock Auditado**

**Tabla de stock:**
```sql
product_stock {
  id              UUID (PK)
  product_id      UUID (FK a products, UNIQUE)
  stock_current   INTEGER (derivado de movimientos)
  stock_min       INTEGER (default: 0)
  updated_at      TIMESTAMP
}
```

**Tabla de movimientos:**
```sql
stock_movements {
  id              UUID (PK)
  tenant_id       UUID (FK a stores)
  product_id      UUID (FK a products)
  type            TEXT (purchase, sale, adjustment, cancelation)
  quantity        INTEGER (+ / -)
  reference_id    UUID (opcional)
  created_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ El stock solo se modifica por movimientos
- ✅ Nunca se pisa stock directamente
- ✅ Toda modificación genera un movimiento
- ✅ El stock actual es derivado de los movimientos (trigger automático)
- ✅ No se puede vender stock negativo (validación en backend)

### 5. **Valorización de Stock**

Helpers implementados para:
- ✅ Valor por costo (`cost × stock_current`)
- ✅ Valor por precio de venta (por lista de precios)

**Características:**
- ✅ No se persisten valores calculados
- ✅ Siempre se calcula desde backend
- ✅ Soporta valorización por costo o por precio de lista

---

## 🔌 Endpoints Implementados

### Productos

- ✅ `POST /api/products` - Crear producto
- ✅ `GET /api/products` - Listar productos (con filtros y paginación)
- ✅ `GET /api/products/:id` - Obtener producto por ID
- ✅ `PUT /api/products/:id` - Actualizar producto
- ✅ `DELETE /api/products/:id` - Eliminar producto (soft delete)

### Rubros

- ✅ `POST /api/categories` - Crear categoría
- ✅ `GET /api/categories` - Listar categorías
- ✅ `PUT /api/categories/:id` - Actualizar categoría
- ✅ `DELETE /api/categories/:id` - Eliminar categoría

### Precios

- ✅ `GET /api/products/:id/prices` - Obtener precios del producto
- ✅ `PUT /api/products/:id/prices` - Actualizar precios del producto

**Ejemplo de uso:**
```json
PUT /api/products/:id/prices
{
  "priceList1": 1500.00,
  "priceList2": 1400.00,
  "priceList3": 1300.00,
  "priceList4": 1200.00
}
```

### Stock

- ✅ `GET /api/stock?tenantId=xxx` - Listar stock de todos los productos
- ✅ `GET /api/stock/:productId` - Obtener stock de un producto
- ✅ `POST /api/stock/adjustment` - Ajustar stock

**Ejemplo de ajuste:**
```json
POST /api/stock/adjustment
{
  "productId": "uuid",
  "quantity": 10,
  "type": "adjustment",
  "referenceId": null
}
```

### Valorización

- ✅ `GET /api/stock/valuation?type=cost&tenantId=xxx` - Valorización por costo
- ✅ `GET /api/stock/valuation?type=price&priceList=1&tenantId=xxx` - Valorización por precio

**Ejemplo de respuesta:**
```json
{
  "type": "cost",
  "priceListId": null,
  "tenantId": "uuid",
  "totalValuationCost": 50000.00,
  "totalValuationPrice": 0,
  "count": 10,
  "items": [...]
}
```

---

## 🔐 Seguridad y Arquitectura

- ✅ Autenticación obligatoria (Bearer token) en todos los endpoints
- ✅ Multi-tenant obligatorio (`tenant_id` o `x-tenant-id` header)
- ✅ Validaciones con Zod en todos los endpoints
- ✅ Helpers reutilizables (no lógica en rutas)
- ✅ Sin lógica duplicada
- ✅ Manejo de errores consistente

---

## 🧪 Criterios de Aceptación

- ✅ No se puede vender stock negativo (validación implementada)
- ✅ Todos los movimientos quedan auditados
- ✅ El stock es consistente luego de múltiples movimientos (trigger automático)
- ✅ Los precios se leen siempre desde backend
- ✅ No hay cálculos de negocio en frontend
- ✅ Código alineado con convenciones existentes

---

## 📄 Archivos Creados/Modificados

### Migraciones
- ✅ `migrations/sprint1_core_products_stock.sql` - Migración completa del núcleo comercial

### Schema
- ✅ `src/db/schema.ts` - Actualizado con nuevos campos y tablas

### Validaciones
- ✅ `src/validations/product-sprint1.ts` - Actualizado con nuevos campos

### Helpers
- ✅ `src/lib/stock-valuation-helpers.ts` - Helpers para valorización

### Endpoints
- ✅ `src/app/api/products/route.ts` - Actualizado con nuevos campos
- ✅ `src/app/api/products/[id]/route.ts` - Actualizado con nuevos campos
- ✅ `src/app/api/products/[id]/prices/route.ts` - Nuevo endpoint de precios
- ✅ `src/app/api/stock/route.ts` - Nuevo endpoint de stock
- ✅ `src/app/api/stock/[productId]/route.ts` - Nuevo endpoint de stock por producto
- ✅ `src/app/api/stock/adjustment/route.ts` - Nuevo endpoint de ajuste
- ✅ `src/app/api/stock/valuation/route.ts` - Nuevo endpoint de valorización

---

## 🚀 Próximos Pasos

El sistema está listo para construir:
- ✅ Ventas (Sprint 2)
- ✅ Compras (Sprint 3)
- ✅ Reportes (Sprint 4)

---

## 📝 Notas Técnicas

### Trigger de Stock

Se implementó un trigger automático que actualiza `product_stock.stock_current` cada vez que se inserta, actualiza o elimina un movimiento en `stock_movements`. Esto garantiza que el stock siempre esté sincronizado.

### Migración de Datos Existentes

La migración incluye:
- Migración de stock existente de `products.stock` a `product_stock`
- Creación de movimientos iniciales para productos con stock
- Actualización de estructura de `stock_movements` si existe

### Validación de Unicidad

Los índices únicos garantizan:
- SKU único por tenant
- Barcode único por tenant (si está presente)
- Precio único por producto y lista de precios

---

## ✅ Checklist de Implementación

- [x] Tablas y relaciones creadas
- [x] Helpers de negocio documentados
- [x] Endpoints funcionando y probados
- [x] Documento SPRINT_1_CORE_PRODUCTS_STOCK.md creado
- [x] Listo para construir Ventas y Compras encima

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRODUCCIÓN**
