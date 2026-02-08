# ✅ SPRINT 4 — Ventas, Clientes y Stock Saliente

**Fecha:** Enero 2025  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el flujo completo de ventas internas, permitiendo:

- ✅ Alta y gestión de clientes
- ✅ Registro de ventas
- ✅ Descuento automático de stock
- ✅ Auditoría de salidas de mercadería
- ✅ Base sólida para cuentas corrientes y pagos futuros

**⚠️ NO incluye:** Pagos, cajas ni facturación fiscal (AFIP)  
**⚠️ NO frontend**

---

## 📋 Entregables Completados

### 1. **Clientes (Customers)**

**Tabla `customers` creada:**
```sql
customers {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  name            TEXT (obligatorio)
  document        TEXT (opcional, único por tenant)
  email           TEXT (opcional)
  phone           TEXT (opcional)
  address         TEXT (opcional)
  active          BOOLEAN (default: true) -- Soft delete
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ `name` obligatorio
- ✅ Soft delete con `active = false`
- ✅ Multi-tenant obligatorio
- ✅ `document` único por tenant (solo si existe)
- ✅ Clientes inactivos no pueden usarse en ventas

**Endpoints:**
- ✅ `GET /api/customers?tenantId=xxx` - Listar clientes (filtra activos por defecto)
- ✅ `POST /api/customers` - Crear cliente
- ✅ `GET /api/customers/:id` - Obtener cliente por ID
- ✅ `PUT /api/customers/:id` - Actualizar cliente
- ✅ `DELETE /api/customers/:id` - Eliminar cliente (soft delete: `active = false`)

**Validaciones:**
- ✅ Documento único por tenant (si se proporciona)
- ✅ Email válido (si se proporciona)
- ✅ Validación de unicidad en creación y actualización

### 2. **Ventas (Sales)**

**Tabla `sales` actualizada:**
```sql
sales {
  id                  UUID (PK)
  tenant_id           UUID (FK stores)
  customer_id         UUID (FK customers, nullable) -- SPRINT 4: Cliente (nullable → venta mostrador)
  date                TIMESTAMP (obligatorio) -- SPRINT 4: Fecha de venta
  subtotal            NUMERIC(15,2) (calculado) -- SPRINT 4: Suma de ítems
  discount_percentage NUMERIC(5,2) (default: 0) -- SPRINT 4: Porcentaje de descuento
  discount_amount     NUMERIC(15,2) (calculado) -- SPRINT 4: Monto de descuento
  total               NUMERIC(15,2) (calculado) -- SPRINT 4: subtotal - discount_amount
  status              TEXT (default: 'draft') -- SPRINT 4: draft | confirmed | cancelled
  notes               TEXT (opcional)
  created_at          TIMESTAMP
  updated_at          TIMESTAMP
  -- Backward compatibility: seller_id, payment_method, etc.
}
```

**Reglas implementadas:**
- ✅ Estado inicial: `draft` (no impacta stock)
- ✅ `subtotal` = suma de ítems (calculado en backend)
- ✅ `discount_amount` = `subtotal * (discount_percentage / 100)` o valor proporcionado
- ✅ `total` = `subtotal - discount_amount` (redondeado a 2 decimales)
- ✅ Venta NO confirmada no impacta stock
- ✅ No se puede modificar venta confirmada (solo cancelar)
- ✅ Fechas normalizadas a inicio del día (00:00:00)

**Flujo de estados:**
1. **Crear venta** → Estado: `draft` (no impacta stock)
2. **Confirmar venta** → Estado: `confirmed` (genera movimientos de stock)
3. **Cancelar venta** → Estado: `cancelled` (solo si está `confirmed`, genera movimientos inversos)

### 3. **Ítems de Venta (Sale Items)**

**Tabla `sale_items` actualizada:**
```sql
sale_items {
  id            UUID (PK)
  sale_id       UUID (FK sales)
  product_id    UUID (FK products)
  variant_id    UUID (FK variants, nullable)
  quantity      NUMERIC (soporta pesables)
  unit_price    NUMERIC(15,2)
  total_price   NUMERIC(15,2) -- SPRINT 4: quantity * unit_price
  created_at    TIMESTAMP
  -- Backward compatibility: subtotal, total, etc.
}
```

**Reglas implementadas:**
- ✅ `total_price = quantity * unit_price` (calculado en backend)
- ✅ `unit_price` tomado del producto o lista vigente
- ✅ Validar stock disponible antes de confirmar venta
- ✅ No se permite vender productos inactivos
- ✅ No se permite stock negativo

### 4. **Movimiento de Stock por Venta**

**Integración con Sprint 1:**
- ✅ Al confirmar una venta:
  - Genera movimientos en `stock_movements`
  - Tipo: `sale`
  - Cantidad negativa (salida)
  - Asociado a `sale_id`
  - Fecha consistente con la venta
- ✅ Al cancelar una venta confirmada:
  - Genera movimientos inversos
  - Tipo: `cancelation`
  - Cantidad positiva (entrada)
  - Revierte el stock descontado

**Validaciones:**
- ✅ Si no hay stock suficiente → Rechazar confirmación
- ✅ Error claro y descriptivo con stock disponible vs solicitado

---

## 🔌 Endpoints Implementados

### Clientes

#### `POST /api/customers`
Crear nuevo cliente.

**Body:**
```json
{
  "name": "Juan Pérez",
  "document": "12345678", // Opcional, único por tenant
  "email": "juan@example.com", // Opcional
  "phone": "+5491112345678", // Opcional
  "address": "Calle 123", // Opcional
  "active": true // Opcional, default: true
}
```

**Response:** Cliente creado (201)

#### `GET /api/customers?tenantId=xxx`
Listar clientes con paginación y búsqueda.

**Query params:**
- `tenantId` (opcional, puede venir en header `x-tenant-id`)
- `page` (default: 1)
- `limit` (default: 50)
- `search` (búsqueda en name, email, phone, document)
- `includeInactive` (default: false)

**Response:**
```json
{
  "customers": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

#### `GET /api/customers/:id`
Obtener cliente por ID.

**Response:** Cliente completo

#### `PUT /api/customers/:id`
Actualizar cliente.

**Body:** Mismos campos que POST (todos opcionales)

**Response:** Cliente actualizado

#### `DELETE /api/customers/:id`
Eliminar cliente (soft delete: `active = false`).

**Response:** Cliente eliminado

### Ventas

#### `POST /api/sales`
Crear nueva venta (estado: `draft`).

**Body:**
```json
{
  "customerId": "uuid", // Opcional (nullable → venta mostrador)
  "date": "2025-01-15", // Opcional (default: now)
  "discountPercentage": 10, // Opcional (default: 0)
  "discountAmount": 100, // Opcional (se calcula si no se proporciona)
  "notes": "Venta mayorista", // Opcional
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid", // Opcional
      "quantity": 2,
      "unitPrice": 150.50
    }
  ]
}
```

**Response:** Venta creada con items (201)

**Notas:**
- `subtotal`, `discount_amount` y `total` se calculan automáticamente
- Estado inicial: `draft` (no impacta stock)
- No se valida stock al crear (solo al confirmar)

#### `GET /api/sales?tenantId=xxx`
Listar ventas con filtros y paginación.

**Query params:**
- `tenantId` (opcional, puede venir en header)
- `page` (default: 1)
- `limit` (default: 50)
- `status` (filtro por estado: draft, confirmed, cancelled)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 200,
    "totalPages": 4
  }
}
```

#### `GET /api/sales/:id`
Obtener venta por ID con items y customer.

**Response:** Venta completa con relaciones

#### `PUT /api/sales/:id`
Actualizar venta (solo si está en estado `draft`).

**Body:**
```json
{
  "customerId": "uuid", // Opcional
  "date": "2025-01-15", // Opcional
  "discountPercentage": 15, // Opcional
  "notes": "Notas actualizadas", // Opcional
  "items": [...] // Opcional (reemplaza todos los items)
}
```

**Response:** Venta actualizada

**Validaciones:**
- ❌ No se puede modificar si `status !== 'draft'`
- ✅ Si se actualizan items, se recalculan totales automáticamente

#### `POST /api/sales/:id/confirm`
Confirmar venta (cambia a `confirmed` y genera movimientos de stock).

**Response:** Venta confirmada con items

**Validaciones:**
- ✅ Solo se puede confirmar si `status === 'draft'`
- ✅ Valida stock disponible para todos los items
- ✅ Si no hay stock suficiente → Error descriptivo
- ✅ Genera movimientos de stock automáticamente

#### `POST /api/sales/:id/cancel`
Cancelar venta (solo si está `confirmed`, genera movimientos inversos).

**Response:** Venta cancelada con items

**Validaciones:**
- ✅ Solo se puede cancelar si `status === 'confirmed'`
- ✅ Genera movimientos de stock inversos (cancelation)
- ✅ Revierte el stock descontado

---

## 🛠️ Helpers Implementados

### `src/lib/sale-helpers-sprint4.ts`

#### `normalizeSaleDate(date: string | Date | undefined): string`
Normaliza la fecha de venta a inicio del día (00:00:00).

#### `validateProductStockForSale(productId: string, quantity: number, tenantId: string)`
Valida que un producto esté activo y tenga stock suficiente.

**Returns:** `{ valid: boolean, error?: string, stockAvailable?: number }`

#### `validateSaleItemsStock(items: Array<{ productId: string, quantity: number | string }>, tenantId: string)`
Valida que todos los productos de una venta tengan stock suficiente.

**Returns:** `{ valid: boolean, error?: string }`

#### `calculateSaleTotals(items: Array<{ quantity: number, unitPrice: number }>, discountPercentage?: number, discountAmount?: number): SaleTotals`
Calcula los totales de una venta:
- `subtotal` = suma de ítems
- `discount_amount` = calculado desde porcentaje o valor proporcionado
- `total` = `subtotal - discount_amount` (redondeado a 2 decimales)

**Returns:** `{ subtotal: number, discountAmount: number, total: number }`

#### `createStockMovementsForSale(tenantId: string, saleId: string, items: Array<{ productId: string, quantity: number }>): Promise<void>`
Crea movimientos de stock para una venta confirmada (tipo: `sale`, cantidad negativa).

#### `createStockMovementsForCancelation(tenantId: string, saleId: string, items: Array<{ productId: string, quantity: number }>): Promise<void>`
Crea movimientos de stock inversos para una venta cancelada (tipo: `cancelation`, cantidad positiva).

#### `confirmSale(saleId: string, tenantId: string): Promise<{ success: boolean, error?: string }>`
Confirma una venta:
1. Valida que esté en estado `draft`
2. Valida stock disponible
3. Crea movimientos de stock
4. Actualiza estado a `confirmed`

#### `cancelSale(saleId: string, tenantId: string): Promise<{ success: boolean, error?: string }>`
Cancela una venta:
1. Valida que esté en estado `confirmed`
2. Crea movimientos de stock inversos
3. Actualiza estado a `cancelled`

---

## 📊 Validaciones Implementadas

### Clientes
- ✅ `name` obligatorio (min 1, max 255 caracteres)
- ✅ `document` único por tenant (solo si existe)
- ✅ `email` válido (si se proporciona)
- ✅ `phone` max 50 caracteres
- ✅ `address` max 500 caracteres
- ✅ Soft delete con `active = false`

### Ventas
- ✅ `customerId` debe existir y estar activo (si se proporciona)
- ✅ `date` normalizada a inicio del día
- ✅ `discountPercentage` entre 0 y 100
- ✅ `discountAmount` no negativo
- ✅ `items` mínimo 1 item
- ✅ Productos deben existir y estar activos
- ✅ Variantes deben existir y pertenecer al producto
- ✅ Stock suficiente antes de confirmar
- ✅ No se puede modificar si `status !== 'draft'`
- ✅ Solo se puede confirmar si `status === 'draft'`
- ✅ Solo se puede cancelar si `status === 'confirmed'`

---

## 🗄️ Migración SQL

**Archivo:** `migrations/sprint4_sales_customers.sql`

**Cambios aplicados:**
1. ✅ Crear tabla `customers`
2. ✅ Agregar campos a `sales` (customer_id, date, discount_percentage, discount_amount)
3. ✅ Agregar campo `total_price` a `sale_items`
4. ✅ Actualizar default de `status` a `draft` en `sales`
5. ✅ Crear índices y constraints
6. ✅ Trigger para `updated_at` en `customers`

---

## 🧪 Criterios de Aceptación

### ✅ Completados

1. ✅ Se puede crear una venta en estado `draft`
2. ✅ Se puede confirmar una venta (valida stock y genera movimientos)
3. ✅ Se puede cancelar una venta confirmada (revierte stock)
4. ✅ El stock se descuenta correctamente al confirmar
5. ✅ El stock se recupera correctamente al cancelar
6. ✅ Todo el proceso queda auditado sin inconsistencias
7. ✅ No se puede modificar ventas confirmadas
8. ✅ No se puede vender stock negativo
9. ✅ Clientes con documento único por tenant
10. ✅ Multi-tenant funcionando en todos los endpoints

---

## 🔄 Flujo Completo de Venta

### 1. Crear Venta (Draft)
```
POST /api/sales
{
  "customerId": "uuid", // Opcional
  "items": [...]
}
→ Estado: draft
→ No impacta stock
```

### 2. Confirmar Venta
```
POST /api/sales/:id/confirm
→ Valida stock disponible
→ Genera movimientos de stock (tipo: sale, cantidad negativa)
→ Estado: confirmed
```

### 3. Cancelar Venta (si es necesario)
```
POST /api/sales/:id/cancel
→ Solo si status === 'confirmed'
→ Genera movimientos inversos (tipo: cancelation, cantidad positiva)
→ Estado: cancelled
```

---

## 📝 Notas de Implementación

### Backward Compatibility
- ✅ Se mantienen campos del Sprint 2 (seller_id, payment_method, etc.) para compatibilidad
- ✅ Los campos nuevos del Sprint 4 coexisten con los anteriores
- ✅ Los endpoints funcionan con ambos esquemas

### Cálculos en Backend
- ✅ Todos los totales se calculan en backend
- ✅ El frontend solo envía datos, no calcula
- ✅ Redondeo a 2 decimales en todos los cálculos

### Transacciones
- ✅ Las operaciones críticas (confirmar, cancelar) usan validaciones antes de modificar
- ✅ Si falla algo, se revierten los cambios (rollback manual)

### Auditoría
- ✅ Todos los movimientos de stock quedan registrados
- ✅ Las ventas nunca se borran (solo se cancelan)
- ✅ Trazabilidad completa: cliente → venta → items → stock_movements

---

## 🚀 Preparación para Próximos Sprints

Este sprint deja preparado:

- ✅ Relación cliente ↔ ventas
- ✅ Base para cuentas corrientes
- ✅ Base para pagos
- ✅ Base para reportes de ventas
- ✅ Base para caja por vendedor

**No implementado todavía:**
- ❌ Pagos
- ❌ Caja
- ❌ Vendedores (ya existe del Sprint 2, pero no integrado en Sprint 4)
- ❌ Facturación fiscal
- ❌ Reportes complejos

---

## ✅ Estado Final

**Sprint 4 completado exitosamente.**

- ✅ Todas las entidades implementadas
- ✅ Todos los endpoints funcionando
- ✅ Validaciones completas
- ✅ Helpers reutilizables
- ✅ Migración aplicada
- ✅ Código limpio y documentado
- ✅ Listo para Sprint 5 (Cuentas Corrientes y Pagos)

---

**Fin del documento**
