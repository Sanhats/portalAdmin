# ✅ SPRINT 2 — POS Core: Ventas, Caja y Vendedores

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el núcleo operativo del POS, permitiendo:

- ✅ Registrar ventas reales
- ✅ Impactar stock automáticamente
- ✅ Manejar caja diaria
- ✅ Auditar ventas por vendedor
- ✅ Permitir anulaciones sin romper consistencia

---

## 📋 Entregables Completados

### 1. **Vendedores (Sellers)**

**Tabla `sellers`:**
```sql
sellers {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  name            TEXT
  active          BOOLEAN (default: true)
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ Ventas siempre asociadas a un vendedor
- ✅ Cierre de caja es por vendedor
- ✅ Vendedores inactivos no pueden vender
- ✅ Un vendedor solo puede tener una caja abierta

**Endpoints:**
- ✅ `POST /api/sellers` - Crear vendedor
- ✅ `GET /api/sellers` - Listar vendedores
- ✅ `GET /api/sellers/:id` - Obtener vendedor
- ✅ `PUT /api/sellers/:id` - Actualizar vendedor
- ✅ `DELETE /api/sellers/:id` - Eliminar vendedor

### 2. **Ventas (Sales)**

**Tabla `sales` actualizada:**
```sql
sales {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  seller_id       UUID (FK sellers) -- SPRINT 2
  total           NUMERIC(15,2) -- SPRINT 2
  discount_total  NUMERIC(15,2) default 0 -- SPRINT 2
  payment_method  TEXT (cash, card, transfer, mixed) -- SPRINT 2
  cash_received   NUMERIC(15,2) nullable -- SPRINT 2
  change_given    NUMERIC(15,2) nullable -- SPRINT 2
  status          TEXT (confirmed, canceled) -- SPRINT 2
  created_at      TIMESTAMP
}
```

**Tabla `sale_items` actualizada:**
```sql
sale_items {
  id            UUID (PK)
  sale_id       UUID (FK sales)
  product_id    UUID (FK products)
  quantity      NUMERIC -- SPRINT 2: Soporta pesables
  unit_price    NUMERIC(15,2)
  total         NUMERIC(15,2) -- SPRINT 2
}
```

**Reglas implementadas:**
- ✅ Una venta confirmada impacta stock y caja
- ✅ Una venta cancelada revierte stock y caja
- ✅ El cálculo de vuelto se valida en backend
- ✅ El total ya viene calculado desde backend
- ✅ Precio se toma desde lista de precios
- ✅ No se permite vender productos inactivos
- ✅ No se permite stock negativo

**Endpoints:**
- ✅ `POST /api/sales` - Crear venta
- ✅ `GET /api/sales` - Listar ventas
- ✅ `GET /api/sales/:id` - Obtener venta
- ✅ `POST /api/sales/:id/cancel` - Anular venta

### 3. **Stock (Integración)**

**Integración con Sprint 1:**
- ✅ Al confirmar una venta: se genera `stock_movement` tipo `sale` con cantidad negativa
- ✅ Al cancelar una venta: se genera `stock_movement` tipo `cancelation` con cantidad positiva
- ✅ El stock NO se pisa nunca directamente
- ✅ Todos los movimientos quedan auditados

### 4. **Caja (Cash Sessions)**

**Tabla `cash_sessions`:**
```sql
cash_sessions {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  seller_id       UUID (FK sellers)
  opening_amount  NUMERIC(15,2)
  closing_amount  NUMERIC(15,2) nullable
  opened_at       TIMESTAMP
  closed_at       TIMESTAMP nullable
  status          TEXT (open, closed)
}
```

**Reglas implementadas:**
- ✅ Un vendedor solo puede tener una caja abierta (constraint en BD)
- ✅ No se puede vender sin caja abierta (validación en backend)
- ✅ El cierre calcula total teórico y diferencia vs real

**Endpoints:**
- ✅ `POST /api/cash/open` - Abrir caja
- ✅ `POST /api/cash/close` - Cerrar caja
- ✅ `GET /api/cash/current` - Obtener caja actual

### 5. **Movimientos de Caja**

**Tabla `cash_movements`:**
```sql
cash_movements {
  id              UUID (PK)
  cash_session_id UUID (FK cash_sessions) -- Sprint 2
  type            TEXT (sale, refund, manual) -- Sprint 2
  amount          NUMERIC(15,2)
  reference_id    UUID nullable (FK a sales.id) -- Sprint 2
  created_at      TIMESTAMP
  -- Nota: Puede coexistir con columnas del Sprint B1 (cash_box_id, etc.)
}
```

**Reglas implementadas:**
- ✅ Cada venta en efectivo genera un movimiento tipo `sale`
- ✅ Anulación genera movimiento tipo `refund` (negativo)
- ✅ Transferencias / tarjetas no afectan efectivo
- ✅ Todos los movimientos quedan auditados
- ✅ Compatible con estructura existente del Sprint B1

---

## 🔌 Endpoints Implementados

### Vendedores

- ✅ `POST /api/sellers` - Crear vendedor
- ✅ `GET /api/sellers?tenantId=xxx` - Listar vendedores
- ✅ `GET /api/sellers/:id` - Obtener vendedor
- ✅ `PUT /api/sellers/:id` - Actualizar vendedor
- ✅ `DELETE /api/sellers/:id` - Eliminar vendedor

### Ventas

- ✅ `POST /api/sales` - Crear venta
- ✅ `GET /api/sales?tenantId=xxx` - Listar ventas
- ✅ `GET /api/sales/:id` - Obtener venta
- ✅ `POST /api/sales/:id/cancel` - Anular venta

### Caja

- ✅ `POST /api/cash/open` - Abrir caja
- ✅ `POST /api/cash/close` - Cerrar caja
- ✅ `GET /api/cash/current?sellerId=xxx` - Obtener caja actual

---

## 🔐 Seguridad y Arquitectura

- ✅ Autenticación obligatoria (Bearer token) en todos los endpoints
- ✅ Multi-tenant obligatorio (`tenant_id` o header `x-tenant-id`)
- ✅ Validaciones con Zod en todos los endpoints
- ✅ Helpers reutilizables (no lógica en rutas)
- ✅ Sin lógica duplicada
- ✅ Manejo de errores consistente

---

## 🧪 Criterios de Aceptación

- ✅ No se puede vender sin caja abierta
- ✅ No se puede vender stock negativo
- ✅ Toda venta impacta stock y caja
- ✅ Toda anulación revierte ambos
- ✅ Todo queda auditado
- ✅ No hay cálculos en frontend
- ✅ Sistema consistente ante errores

---

## 📊 Diagramas de Flujo

### Flujo de Venta

```
1. Validar caja abierta
   ↓
2. Validar productos activos y stock
   ↓
3. Calcular totales (backend)
   ↓
4. Crear venta (status: confirmed)
   ↓
5. Crear sale_items
   ↓
6. Crear stock_movements (tipo: sale, cantidad negativa)
   ↓
7. Si es efectivo: crear cash_movement (tipo: sale)
   ↓
8. Retornar venta creada
```

### Flujo de Anulación

```
1. Validar que venta existe y está confirmada
   ↓
2. Crear stock_movements inversos (tipo: cancelation, cantidad positiva)
   ↓
3. Si fue en efectivo: crear cash_movement (tipo: refund, negativo)
   ↓
4. Actualizar venta (status: canceled)
   ↓
5. Retornar venta cancelada
```

### Flujo de Apertura/Cierre de Caja

**Apertura:**
```
1. Validar que vendedor no tenga caja abierta
   ↓
2. Validar que vendedor esté activo
   ↓
3. Crear cash_session (status: open)
   ↓
4. Retornar sesión creada
```

**Cierre:**
```
1. Obtener caja abierta del vendedor
   ↓
2. Calcular totales de movimientos
   ↓
3. Calcular closing_amount = opening_amount + movimientos
   ↓
4. Actualizar cash_session (status: closed, closing_amount)
   ↓
5. Retornar sesión cerrada con resumen
```

---

## 📄 Archivos Creados/Modificados

### Migraciones
- ✅ `migrations/sprint2_pos_core.sql` - Migración completa del POS Core

### Schema
- ✅ `src/db/schema.ts` - Actualizado con sellers, cash_sessions, cash_movements

### Validaciones
- ✅ `src/validations/seller.ts` - Validaciones para vendedores
- ✅ `src/validations/sale.ts` - Actualizado con campos Sprint 2
- ✅ `src/validations/cash-session.ts` - Validaciones para caja

### Helpers
- ✅ `src/lib/sale-helpers-sprint2.ts` - Helpers para ventas Sprint 2
- ✅ `src/lib/cash-session-helpers.ts` - Helpers para caja

### Endpoints
- ✅ `src/app/api/sellers/route.ts` - CRUD de vendedores
- ✅ `src/app/api/sellers/[id]/route.ts` - Vendedor individual
- ✅ `src/app/api/sales/route.ts` - Actualizado para Sprint 2
- ✅ `src/app/api/sales/[id]/cancel/route.ts` - Actualizado para Sprint 2
- ✅ `src/app/api/cash/open/route.ts` - Abrir caja
- ✅ `src/app/api/cash/close/route.ts` - Cerrar caja
- ✅ `src/app/api/cash/current/route.ts` - Caja actual

---

## 🚀 Próximos Pasos

El sistema está listo para:
- ✅ Registrar ventas reales con impacto en stock y caja
- ✅ Gestionar cajas diarias por vendedor
- ✅ Anular ventas con reversión automática
- ✅ Auditar todas las operaciones

---

## 📝 Notas Técnicas

### Triggers de Base de Datos

- ✅ Trigger para validar que un vendedor solo tenga una caja abierta
- ✅ Trigger para calcular `closing_amount` automáticamente al cerrar

### Validaciones Backend

- ✅ Validación de caja abierta antes de vender
- ✅ Validación de stock suficiente antes de vender
- ✅ Validación de productos activos
- ✅ Cálculo de vuelto en backend

### Integración con Sprint 1

- ✅ Uso de `stock_movements` del Sprint 1
- ✅ Uso de `product_stock` del Sprint 1
- ✅ Uso de `product_prices` del Sprint 1

### Migración de Datos

- ✅ La migración es compatible con estructuras existentes
- ✅ Si `cash_movements` existe con estructura antigua (Sprint B1), se agregan las columnas necesarias (`cash_session_id`, `reference_id`)
- ✅ Se crea un vendedor por defecto para ventas existentes sin `seller_id`
- ✅ Los índices se crean de forma condicional para evitar errores
- ✅ La migración maneja correctamente tablas existentes sin romper datos

---

## ✅ Checklist de Implementación

- [x] Tablas y relaciones creadas
- [x] Helpers de negocio documentados
- [x] Endpoints funcionando y probados
- [x] Integración con stock (Sprint 1)
- [x] Integración con caja
- [x] Documento SPRINT_2_POS_CORE.md creado
- [x] Diagramas de flujo incluidos

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRODUCCIÓN**
