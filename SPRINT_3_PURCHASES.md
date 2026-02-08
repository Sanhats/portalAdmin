# ✅ SPRINT 3 — Módulo Compras, Proveedores y Stock Entrante

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el circuito completo de ingreso de mercadería, permitiendo:

- ✅ Registrar proveedores
- ✅ Registrar compras
- ✅ Impactar stock valorizado correctamente
- ✅ Auditar ingresos de mercadería
- ✅ Mantener coherencia financiera y de inventario

---

## 📋 Entregables Completados

### 1. **Proveedores (Suppliers)**

**Tabla `suppliers` actualizada:**
```sql
suppliers {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  name            TEXT (obligatorio)
  contact_name    TEXT (opcional) -- SPRINT 3
  phone           TEXT (opcional)
  email           TEXT (opcional)
  notes           TEXT (opcional)
  is_active       BOOLEAN (default: true) -- SPRINT 3: Soft delete
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ `name` obligatorio
- ✅ Soft delete con `is_active = false`
- ✅ Multi-tenant obligatorio
- ✅ Proveedores inactivos no pueden usarse en compras

**Endpoints:**
- ✅ `GET /api/suppliers?tenantId=xxx` - Listar proveedores (filtra activos por defecto)
- ✅ `POST /api/suppliers` - Crear proveedor
- ✅ `PUT /api/suppliers/:id` - Actualizar proveedor
- ✅ `DELETE /api/suppliers/:id` - Eliminar proveedor (soft delete: `is_active = false`)

### 2. **Compras (Purchases)**

**Tabla `purchases` actualizada:**
```sql
purchases {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  supplier_id     UUID (FK suppliers)
  invoice_number  TEXT (opcional) -- SPRINT 3
  purchase_date   TIMESTAMP (obligatorio) -- SPRINT 3
  total_amount    NUMERIC(15,2) (calculado automáticamente) -- SPRINT 3
  notes           TEXT (opcional)
  created_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ No se permite modificar una compra una vez creada (trigger en BD + validación backend)
- ✅ No se permite eliminar compras (auditoría obligatoria)
- ✅ `total_amount` se calcula automáticamente desde `purchase_items`
- ✅ Fechas normalizadas a inicio del día (00:00:00)
- ✅ Todo dentro de transacción (rollback si falla algo)

### 3. **Detalle de Compra (Purchase Items)**

**Tabla `purchase_items` actualizada:**
```sql
purchase_items {
  id            UUID (PK)
  purchase_id   UUID (FK purchases)
  product_id    UUID (FK products)
  quantity      NUMERIC (SPRINT 3: soporta decimales)
  unit_cost     NUMERIC(15,2)
  subtotal      NUMERIC(15,2) (quantity * unit_cost) -- SPRINT 3
  created_at    TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ `subtotal = quantity * unit_cost` (validado con trigger)
- ✅ `unit_cost` impacta valorización de stock
- ✅ No permitir `quantity <= 0` (constraint en BD)
- ✅ `quantity` NUMERIC para soportar decimales

### 4. **Movimientos de Stock (Integración)**

**Integración con Sprint 1:**
- ✅ Cada `purchase_item` genera 1 `stock_movement` tipo `purchase`
- ✅ Cantidad positiva (entrada de stock)
- ✅ `reference_id = purchase_id` para trazabilidad
- ✅ El stock se actualiza automáticamente (trigger del Sprint 1)

**Reglas:**
- ✅ No se permiten movimientos manuales fuera de endpoints
- ✅ Flujo obligatorio: crear compra → generar movimientos automáticamente

---

## 🔌 Endpoints Implementados

### Proveedores

- ✅ `GET /api/suppliers?tenantId=xxx` - Listar proveedores
- ✅ `POST /api/suppliers` - Crear proveedor
- ✅ `GET /api/suppliers/:id` - Obtener proveedor
- ✅ `PUT /api/suppliers/:id` - Actualizar proveedor
- ✅ `DELETE /api/suppliers/:id` - Eliminar proveedor (soft delete)

**Ejemplo POST /api/suppliers:**
```json
{
  "name": "Proveedor ABC",
  "contactName": "Juan Pérez",
  "email": "contacto@proveedor.com",
  "phone": "+5491112345678",
  "notes": "Proveedor mayorista",
  "isActive": true
}
```

### Compras

- ✅ `GET /api/purchases?tenantId=xxx` - Listar compras
- ✅ `GET /api/purchases/:id` - Obtener compra
- ✅ `POST /api/purchases` - Crear compra

**Ejemplo POST /api/purchases:**
```json
{
  "supplierId": "uuid",
  "purchaseDate": "2026-02-08",
  "invoiceNumber": "FAC-123",
  "items": [
    {
      "productId": "uuid",
      "quantity": 10,
      "unitCost": 120
    }
  ],
  "notes": "Compra mayorista"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "supplier_id": "uuid",
  "invoice_number": "FAC-123",
  "purchase_date": "2026-02-08T00:00:00Z",
  "total_amount": 1200.00,
  "notes": "Compra mayorista",
  "suppliers": { ... },
  "purchase_items": [ ... ]
}
```

**Restricciones:**
- ❌ `PUT /api/purchases/:id` - Retorna error 400 (no permitido)
- ❌ `DELETE /api/purchases/:id` - Retorna error 400 (no permitido)

---

## 🔐 Seguridad y Arquitectura

- ✅ Autenticación obligatoria (Bearer token) en todos los endpoints
- ✅ Multi-tenant obligatorio (`tenant_id` o header `x-tenant-id`)
- ✅ Validaciones con Zod en todos los endpoints
- ✅ Helpers reutilizables (no lógica en rutas)
- ✅ Sin lógica duplicada
- ✅ Manejo de errores consistente
- ✅ Transacciones para garantizar consistencia

---

## 🧪 Criterios de Aceptación

- ✅ Crear una compra actualiza stock correctamente
- ✅ No hay stock negativo
- ✅ Totales correctos siempre (calculados en backend)
- ✅ Auditoría verificable (todos los movimientos quedan registrados)
- ✅ Multi-tenant funcionando
- ✅ No se puede modificar/eliminar compras
- ✅ Proveedores inactivos no pueden usarse

---

## 📊 Flujo de Creación de Compra

```
1. Validar tenant
   ↓
2. Validar proveedor activo
   ↓
3. Validar productos existentes
   ↓
4. Calcular totales (backend)
   ↓
5. Normalizar fecha (00:00:00)
   ↓
6. Crear purchase
   ↓
7. Crear purchase_items
   ↓
8. Generar stock_movements (tipo: purchase)
   ↓
9. Stock actual se actualiza automáticamente (trigger)
   ↓
10. Retornar compra creada
```

**Si falla cualquier paso → Rollback total**

---

## 📄 Archivos Creados/Modificados

### Migraciones
- ✅ `migrations/sprint3_purchases.sql` - Migración completa del módulo de compras

### Schema
- ✅ `src/db/schema.ts` - Actualizado con campos Sprint 3

### Validaciones
- ✅ `src/validations/supplier.ts` - Actualizado con `contact_name` e `is_active`
- ✅ `src/validations/purchase.ts` - Actualizado con `invoice_number`, `purchase_date`, `quantity` NUMERIC

### Helpers
- ✅ `src/lib/purchase-helpers-sprint3.ts` - Helpers para compras con transacción

### Endpoints
- ✅ `src/app/api/suppliers/route.ts` - Actualizado para Sprint 3
- ✅ `src/app/api/suppliers/[id]/route.ts` - Actualizado para Sprint 3
- ✅ `src/app/api/purchases/route.ts` - Actualizado para Sprint 3
- ✅ `src/app/api/purchases/[id]/route.ts` - Actualizado (PUT/DELETE deshabilitados)

---

## 📝 Notas Técnicas

### Triggers de Base de Datos

- ✅ Trigger para calcular `total_amount` automáticamente desde `purchase_items`
- ✅ Trigger para validar `subtotal = quantity * unit_cost`
- ✅ Trigger para prevenir modificaciones de compras (después de creada)
- ✅ Constraint para `quantity > 0`

### Validaciones Backend

- ✅ Validación de proveedor activo antes de crear compra
- ✅ Validación de productos existentes
- ✅ Cálculo de totales en backend (no frontend)
- ✅ Normalización de fechas (00:00:00)

### Integración con Sprint 1

- ✅ Uso de `stock_movements` del Sprint 1
- ✅ Uso de `product_stock` del Sprint 1
- ✅ Movimientos automáticos al crear compra

### Transacciones

- ✅ Toda la creación de compra está dentro de una transacción lógica
- ✅ Si falla cualquier paso, se hace rollback manual
- ✅ Stock siempre consistente

---

## 🔍 Auditoría

Debe ser posible responder:

- ✅ **Qué proveedor ingresó mercadería**: `purchases.supplier_id` → `suppliers.name`
- ✅ **Cuándo**: `purchases.purchase_date`
- ✅ **Qué productos**: `purchase_items.product_id` → `products.name_internal`
- ✅ **En qué cantidad**: `purchase_items.quantity`
- ✅ **A qué costo**: `purchase_items.unit_cost`

**Sin cálculos posteriores** - Todo queda persistido en las tablas.

---

## ✅ Checklist de Implementación

- [x] Tablas y relaciones creadas/actualizadas
- [x] Helpers de negocio documentados
- [x] Endpoints funcionando y probados
- [x] Integración con stock (Sprint 1)
- [x] Transacciones implementadas
- [x] Validaciones completas
- [x] Documento SPRINT_3_PURCHASES.md creado
- [x] No se puede modificar/eliminar compras
- [x] Auditoría completa

---

## 🚀 Próximos Pasos

El sistema está listo para:
- ✅ Registrar compras con impacto automático en stock
- ✅ Auditar todos los ingresos de mercadería
- ✅ Mantener coherencia financiera y de inventario
- ✅ Continuar con Sprint 4 (Cuentas Corrientes)

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRODUCCIÓN**
