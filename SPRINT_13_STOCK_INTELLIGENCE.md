# ✅ SPRINT 13 — Gestión Inteligente de Stock

**Fecha:** Enero 2025  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Extender el modelo de stock actual para soportar reglas de reposición, alertas automáticas y consultas inteligentes, sin romper la arquitectura existente.

---

## 📋 Entregables Completados

### 1. **Stock por Sucursal (Extensión)**

**Tabla `product_stock_branches` creada:**
```sql
product_stock_branches {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  branch_id       UUID (FK branches)
  product_id      UUID (FK products)
  min_stock       INTEGER (nullable)
  ideal_stock     INTEGER (nullable)
  reorder_enabled BOOLEAN DEFAULT false
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
  UNIQUE(branch_id, product_id)
}
```

**Reglas implementadas:**
- ✅ Configuración por producto y sucursal
- ✅ `min_stock` nullable (si no se configura, no hay alertas)
- ✅ `ideal_stock` nullable (para sugerencias de reposición)
- ✅ `reorder_enabled` para habilitar sugerencias automáticas

**Índices:**
- ✅ Por tenant, branch, product
- ✅ Por `reorder_enabled` (para consultas de sugerencias)

---

### 2. **StockAlert (Nueva Tabla)**

**Tabla `stock_alerts` creada:**
```sql
stock_alerts {
  id            UUID (PK)
  tenant_id     UUID (FK stores)
  branch_id     UUID (FK branches)
  product_id    UUID (FK products)
  current_stock INTEGER
  min_stock     INTEGER
  alert_type    TEXT (LOW_STOCK | OUT_OF_STOCK)
  status        TEXT (ACTIVE | RESOLVED) DEFAULT 'ACTIVE'
  created_at    TIMESTAMP
  resolved_at   TIMESTAMP (nullable)
  UNIQUE(branch_id, product_id, status) WHERE status = 'ACTIVE'
}
```

**Reglas implementadas:**
- ✅ Se crea automáticamente mediante trigger
- ✅ No se elimina, solo se resuelve (soft delete con `status`)
- ✅ Solo una alerta activa por producto y sucursal
- ✅ Se resuelve automáticamente cuando `stock >= min_stock`

**Índices:**
- ✅ Por tenant, branch, product, status, alert_type
- ✅ Combinado (tenant_id, branch_id, status)

---

### 3. **Detección Automática de Alertas**

**Función SQL `detect_stock_alert()`:**
- ✅ Se dispara automáticamente después de movimientos de stock
- ✅ Calcula stock actual por sucursal
- ✅ Compara con `min_stock` de la configuración
- ✅ Crea alerta si `stock <= 0` → `OUT_OF_STOCK`
- ✅ Crea alerta si `stock > 0` y `stock < min_stock` → `LOW_STOCK`
- ✅ Resuelve alerta activa si `stock >= min_stock`

**Trigger `trigger_detect_stock_alert`:**
- ✅ Se ejecuta después de `INSERT` o `UPDATE` en `stock_movements`
- ✅ Solo si `branch_id` está presente (SPRINT 12+)
- ✅ Llama a `detect_stock_alert()` automáticamente

**Integración:**
- ✅ Se dispara al confirmar ventas
- ✅ Se dispara al cancelar ventas
- ✅ Se dispara al ajustar stock manualmente
- ✅ Se dispara al modificar `min_stock` en configuración

---

### 4. **Sugerencias de Reposición (Query-Based)**

**Función `getReplenishmentSuggestions()`:**
- ✅ Calcula sugerencias desde configuración (no tabla persistida)
- ✅ Solo productos con `reorder_enabled = true`
- ✅ Solo si `ideal_stock > stock_actual`
- ✅ `cantidad_sugerida = ideal_stock - stock_actual`
- ✅ Asocia proveedor sugerido (última compra del producto)

**Cálculo:**
```typescript
suggestedQuantity = idealStock - currentStock
```

**Condiciones:**
- ✅ `reorder_enabled = true`
- ✅ `ideal_stock IS NOT NULL`
- ✅ `ideal_stock > 0`
- ✅ `currentStock < idealStock`

---

## 🔌 Endpoints Implementados

### Alertas

#### `GET /api/stock/alerts`
Lista alertas de stock con filtros opcionales.

**Query params:**
- `tenantId` (requerido, puede venir en header `x-tenant-id`)
- `branchId` (opcional)
- `productId` (opcional)
- `alertType` (opcional: `LOW_STOCK` | `OUT_OF_STOCK`)
- `status` (opcional: `ACTIVE` | `RESOLVED`)

**Response:**
```json
[
  {
    "id": "uuid",
    "tenantId": "uuid",
    "branchId": "uuid",
    "productId": "uuid",
    "currentStock": 5,
    "minStock": 10,
    "alertType": "LOW_STOCK",
    "status": "ACTIVE",
    "createdAt": "2025-01-15T10:00:00Z",
    "resolvedAt": null,
    "product": {
      "id": "uuid",
      "nameInternal": "Producto A",
      "sku": "PROD-001"
    },
    "branch": {
      "id": "uuid",
      "name": "Sucursal Centro"
    }
  }
]
```

#### `GET /api/stock/alerts/summary`
Resumen de alertas (totales, por tipo, por estado).

**Query params:**
- `tenantId` (requerido)
- `branchId` (opcional)

**Response:**
```json
{
  "total": 25,
  "active": 15,
  "resolved": 10,
  "byType": {
    "LOW_STOCK": 12,
    "OUT_OF_STOCK": 3
  },
  "byStatus": {
    "ACTIVE": 15,
    "RESOLVED": 10
  }
}
```

---

### Configuración de Stock

#### `PATCH /api/stock/:productId/config`
Actualiza o crea configuración de stock para un producto en una sucursal.

**Body:**
```json
{
  "branchId": "uuid",
  "minStock": 10,
  "idealStock": 50,
  "reorderEnabled": true
}
```

**Parámetros:**
- `productId` (en la URL)

**Body:**
```json
{
  "branchId": "uuid",
  "minStock": 10,
  "idealStock": 50,
  "reorderEnabled": true
}
```

**Validaciones:**
- ✅ `branchId` es requerido
- ✅ `minStock` nullable (si es null, no hay alertas)
- ✅ `idealStock` nullable (si es null, no hay sugerencias)
- ✅ `reorderEnabled` default: `false`
- ✅ Producto debe existir y pertenecer al tenant
- ✅ Sucursal debe existir y pertenecer al tenant

**Response:**
```json
{
  "minStock": 10,
  "idealStock": 50,
  "reorderEnabled": true
}
```

**Efectos:**
- ✅ Si se modifica `min_stock`, se dispara detección automática de alertas
- ✅ Si se habilita `reorder_enabled`, el producto aparece en sugerencias

---

### Sugerencias de Reposición

#### `GET /api/stock/replenishment/suggestions`
Obtiene sugerencias de reposición.

**Query params:**
- `tenantId` (requerido)
- `branchId` (opcional, filtra por sucursal)

**Response:**
```json
[
  {
    "productId": "uuid",
    "branchId": "uuid",
    "product": {
      "id": "uuid",
      "nameInternal": "Producto A",
      "sku": "PROD-001"
    },
    "branch": {
      "id": "uuid",
      "name": "Sucursal Centro"
    },
    "currentStock": 5,
    "idealStock": 50,
    "minStock": 10,
    "suggestedQuantity": 45,
    "supplier": {
      "id": "uuid",
      "name": "Proveedor XYZ"
    }
  }
]
```

**Reglas:**
- ✅ Solo productos con `reorder_enabled = true`
- ✅ Solo si `ideal_stock > stock_actual`
- ✅ Ordenado por `suggestedQuantity` (mayor primero)
- ✅ Proveedor sugerido basado en última compra del producto

---

## 🗄️ Migración SQL

**Archivo:** `migrations/sprint13_stock_intelligence.sql`

**Cambios aplicados:**
1. ✅ Crear tabla `product_stock_branches`
2. ✅ Crear tabla `stock_alerts`
3. ✅ Crear función `get_stock_by_branch()`
4. ✅ Crear función `detect_stock_alert()`
5. ✅ Crear trigger `trigger_detect_stock_alert`
6. ✅ Índices y constraints

---

## ⚙️ Lógica de Negocio

### Detección Automática de Alertas

**Se dispara cuando:**
- ✅ Se confirma una venta (movimiento de stock tipo `sale`)
- ✅ Se cancela una venta (movimiento de stock tipo `cancelation`)
- ✅ Se ajusta stock manualmente (movimiento de stock tipo `adjustment`)
- ✅ Se modifica `min_stock` en configuración

**Reglas:**
- ✅ `stock <= 0` → `OUT_OF_STOCK`
- ✅ `stock > 0` y `stock < min_stock` → `LOW_STOCK`
- ✅ `stock >= min_stock` → resolver alerta activa si existe
- ✅ Solo se crea alerta si existe configuración con `min_stock`

### Sugerencia de Reposición

**Cálculo:**
```typescript
suggestedQuantity = idealStock - currentStock
```

**Condiciones:**
- ✅ `reorder_enabled = true`
- ✅ `ideal_stock IS NOT NULL`
- ✅ `ideal_stock > 0`
- ✅ `currentStock < idealStock`

**Proveedor sugerido:**
- ✅ Última compra del producto (cualquier sucursal)
- ✅ Si no hay compras previas, `supplier` es `undefined`

---

## 📊 Validaciones Implementadas

### Configuración de Stock
- ✅ Producto debe existir y pertenecer al tenant
- ✅ Sucursal debe existir y pertenecer al tenant
- ✅ `min_stock` nullable (si es null, no hay alertas)
- ✅ `ideal_stock` nullable (si es null, no hay sugerencias)
- ✅ `reorder_enabled` default: `false`

### Alertas
- ✅ Solo una alerta activa por producto y sucursal (constraint único)
- ✅ No se elimina, solo se resuelve
- ✅ Se crea automáticamente mediante trigger
- ✅ Se resuelve automáticamente cuando `stock >= min_stock`

### Sugerencias
- ✅ Solo productos con `reorder_enabled = true`
- ✅ Solo si `ideal_stock > stock_actual`
- ✅ Ordenado por cantidad sugerida (mayor primero)

---

## 🔄 Integración con Sprints Anteriores

### SPRINT 12 (Multi-Sucursal)
- ✅ Alertas y configuración por sucursal
- ✅ Movimientos de stock incluyen `branch_id`
- ✅ Stock calculado por sucursal

### SPRINT 6 (Caja)
- ✅ Sin cambios (alertas no afectan caja)

### SPRINT 4 (Ventas)
- ✅ Alertas se disparan al confirmar ventas
- ✅ Alertas se resuelven al cancelar ventas

### SPRINT 1 (Stock)
- ✅ Mantiene arquitectura de movimientos
- ✅ No rompe `product_stock` existente
- ✅ Extiende con configuración por sucursal

---

## 🔐 Permisos

### Admin / Manager
- ✅ Configurar reglas de stock (`PATCH /api/stock/:id/config`)
- ✅ Ver alertas (`GET /api/stock/alerts`)
- ✅ Ver resumen de alertas (`GET /api/stock/alerts/summary`)
- ✅ Ver sugerencias (`GET /api/stock/replenishment/suggestions`)

### Cashier / Viewer
- ✅ Solo lectura (alertas visibles)
- ❌ No puede configurar reglas

---

## 🧪 Criterios de Aceptación

### ✅ Completados

1. ✅ Se pueden configurar reglas de stock por producto y sucursal
2. ✅ Las alertas se crean automáticamente
3. ✅ Las alertas se resuelven automáticamente
4. ✅ Las sugerencias de reposición se calculan correctamente
5. ✅ Los endpoints responden correctamente
6. ✅ No se rompe la arquitectura existente
7. ✅ Tipado estricto (sin `any`)
8. ✅ Validaciones server-side
9. ✅ Uso de transacciones donde aplique

---

## 📝 Notas de Implementación

### Fuentes de Verdad

- ✅ **Configuración** → `product_stock_branches`
- ✅ **Alertas** → `stock_alerts` (generadas automáticamente)
- ✅ **Stock actual** → Calculado desde `stock_movements` por sucursal
- ✅ **Sugerencias** → Calculadas desde configuración (query-based)

### Cálculos

- ✅ Stock actual por sucursal: `SUM(quantity) FROM stock_movements WHERE branch_id = X`
- ✅ Cantidad sugerida: `ideal_stock - current_stock`
- ✅ Todas las alertas se calculan en backend/SQL

### Backward Compatibility

- ✅ No rompe `product_stock` existente
- ✅ No rompe movimientos de stock existentes
- ✅ Si no hay configuración, no hay alertas (comportamiento esperado)
- ✅ Si no hay `branch_id` en movimiento, no se dispara alerta (comportamiento esperado)

---

## 🚀 Resultado Esperado

Al finalizar el Sprint 13:

✅ El sistema detecta automáticamente cuando el stock está bajo  
✅ Los usuarios pueden configurar reglas de reposición por producto y sucursal  
✅ El sistema sugiere cantidades de reposición basadas en stock ideal  
✅ Las alertas se resuelven automáticamente cuando el stock se recupera  
✅ La arquitectura existente se mantiene intacta

---

## ✅ Estado Final

**Sprint 13 completado exitosamente.**

- ✅ Tabla `product_stock_branches` creada
- ✅ Tabla `stock_alerts` creada
- ✅ Función `detect_stock_alert()` implementada
- ✅ Trigger automático para detección de alertas
- ✅ Helpers para alertas y sugerencias
- ✅ Endpoints de alertas implementados
- ✅ Endpoint de configuración implementado
- ✅ Endpoint de sugerencias implementado
- ✅ Integración con ventas y ajustes de stock
- ✅ Validaciones completas
- ✅ Migración SQL lista
- ✅ Documentación completa

---

**Fin del documento**
