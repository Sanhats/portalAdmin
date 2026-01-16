# 🎯 SPRINT ERP: Proveedores → Compras → Costos → Margen

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 📋 Resumen Ejecutivo

Se ha implementado el sistema completo de gestión de compras y costos para el POS + ERP liviano, permitiendo:

- ✅ Gestión de proveedores (CRUD completo)
- ✅ Gestión de compras con estados (draft → confirmed → received)
- ✅ Actualización automática de stock al recibir compras
- ✅ Cálculo de costo promedio ponderado
- ✅ Actualización automática de costos en productos
- ✅ Integración con caja diaria (compras como egresos)
- ✅ Trazabilidad completa: compra → stock → costo → venta

---

## 🗄️ Schema de Base de Datos

### Nuevas Tablas

#### 1. `suppliers` (Proveedores)

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);
```

**Características:**
- Multi-tenant obligatorio
- Soft delete
- Campos opcionales: email, phone, notes

#### 2. `purchases` (Compras)

```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES stores(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'confirmed' | 'received' | 'cancelled'
  subtotal NUMERIC(15, 2) DEFAULT 0,
  total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  confirmed_at TIMESTAMP,
  received_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Estados:**
- `draft`: Borrador, editable
- `confirmed`: Confirmada, lista para recibir
- `received`: Recibida, stock y costos actualizados
- `cancelled`: Cancelada

#### 3. `purchase_items` (Items de Compra)

```sql
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(15, 2) NOT NULL,
  total_cost NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Extensiones a Tablas Existentes

#### 1. `products.cost` (Nuevo campo)

```sql
ALTER TABLE products ADD COLUMN cost NUMERIC(15, 2);
```

- **Nullable inicialmente** (productos existentes no tienen costo)
- Se actualiza automáticamente al recibir compras
- Se usa como default en nuevas ventas

#### 2. `stock_movements` (Nuevas referencias)

```sql
ALTER TABLE stock_movements 
ADD COLUMN purchase_id UUID REFERENCES purchases(id),
ADD COLUMN sale_id UUID REFERENCES sales(id);
```

- Trazabilidad completa de movimientos
- `purchase_id`: Movimientos por compras
- `sale_id`: Movimientos por ventas

#### 3. `cash_movements.purchase_id` (Nueva referencia)

```sql
ALTER TABLE cash_movements 
ADD COLUMN purchase_id UUID REFERENCES purchases(id);
```

- Las compras generan movimientos de caja tipo `expense`
- Trazabilidad de egresos

---

## 🔄 Flujo de Estados de Compras

```
draft → confirmed → received
  ↓
cancelled
```

### Transiciones

1. **draft → confirmed**
   - Endpoint: `POST /api/purchases/:id/confirm`
   - Regla: Solo compras en `draft` pueden confirmarse
   - Acción: Actualiza `confirmed_at`

2. **confirmed → received**
   - Endpoint: `POST /api/purchases/:id/receive`
   - Regla: Solo compras en `confirmed` pueden recibirse
   - Acciones:
     - ✅ Actualiza stock de productos
     - ✅ Calcula y actualiza costo promedio ponderado
     - ✅ Crea movimientos de stock
     - ✅ Crea movimiento de caja (expense)
     - ✅ Actualiza `received_at`

3. **draft/confirmed → cancelled**
   - Endpoint: `DELETE /api/purchases/:id`
   - Regla: No se puede cancelar una compra `received`
   - Acción: Actualiza `cancelled_at`

---

## 💰 Estrategia de Costos

### Costo Promedio Ponderado

**Fórmula:**
```
costo_promedio = (stock_actual * costo_actual + cantidad_compra * costo_compra) / (stock_actual + cantidad_compra)
```

**Implementación:**
- Función: `calculateWeightedAverageCost()` en `src/lib/purchase-helpers.ts`
- Se ejecuta automáticamente al recibir una compra
- Actualiza `products.cost`

### Casos Especiales

1. **Producto sin stock previo o sin costo previo:**
   - Usa el costo de la compra directamente
   - No calcula promedio

2. **Producto con stock y costo:**
   - Calcula promedio ponderado
   - Actualiza ambos: stock y costo

### Uso en Ventas

- El costo del producto (`products.cost`) se usa como **default** en nuevas ventas
- Permite **override manual** (el usuario puede cambiar el costo en la venta)
- El costo se guarda en `sale_items.unit_cost` como **snapshot inmutable**

---

## 🔧 Lógica de Negocio

### Al Recibir una Compra (`POST /api/purchases/:id/receive`)

1. **Validaciones:**
   - ✅ Compra existe y pertenece al tenant
   - ✅ Compra está en estado `confirmed`
   - ✅ Compra tiene items

2. **Procesamiento por Item:**
   ```typescript
   for (const item of purchase_items) {
     // 1. Calcular nuevo costo (promedio ponderado)
     const newCost = calculateWeightedAverageCost(
       productId,
       quantity,
       unitCost
     );
     
     // 2. Actualizar stock y costo del producto
     await updateProductStockAndCost(
       productId,
       quantity,
       unitCost,
       purchaseId
     );
     
     // 3. Crear movimiento de stock
     await createStockMovement({
       product_id: productId,
       reason: `Compra recibida: ${purchaseId}`,
       purchase_id: purchaseId,
       difference: quantity // Positivo
     });
   }
   ```

3. **Actualización de Estado:**
   - Cambia `status` a `received`
   - Actualiza `received_at`

4. **Movimiento de Caja:**
   - Crea `cash_movements` tipo `expense`
   - Solo si hay caja abierta
   - Método de pago: `cash` o `transfer` (configurable)

---

## 📡 Endpoints Implementados

### Proveedores

#### `GET /api/suppliers`
Listar proveedores con paginación y búsqueda.

**Query params:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (búsqueda en name, email, phone)
- `tenantId` (opcional, usa header o default)

**Response:**
```json
{
  "suppliers": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "totalPages": 1
  }
}
```

#### `POST /api/suppliers`
Crear proveedor.

**Body:**
```json
{
  "name": "Proveedor ABC",
  "email": "contacto@proveedor.com",
  "phone": "+54 11 1234-5678",
  "notes": "Notas adicionales"
}
```

#### `GET /api/suppliers/:id`
Obtener proveedor por ID.

#### `PUT /api/suppliers/:id`
Actualizar proveedor.

#### `DELETE /api/suppliers/:id`
Eliminar proveedor (soft delete).  
**Regla:** No se puede eliminar si tiene compras asociadas.

---

### Compras

#### `GET /api/purchases`
Listar compras con paginación y filtros.

**Query params:**
- `page`, `limit`
- `status` (draft, confirmed, received, cancelled)
- `supplierId`
- `tenantId`

**Response incluye:**
- Datos de proveedor
- Items con productos y variantes

#### `POST /api/purchases`
Crear compra.

**Body:**
```json
{
  "supplierId": "uuid",
  "status": "draft",
  "notes": "Notas opcionales",
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid (opcional)",
      "quantity": 10,
      "unitCost": "1500.00"
    }
  ],
  "subtotal": "15000.00" // Opcional, se calcula automáticamente
}
```

#### `GET /api/purchases/:id`
Obtener compra por ID con todas las relaciones.

#### `PUT /api/purchases/:id`
Actualizar compra.  
**Regla:** Solo si está en `draft`.

#### `DELETE /api/purchases/:id`
Cancelar compra.  
**Regla:** No se puede cancelar si ya fue `received`.

#### `POST /api/purchases/:id/confirm`
Confirmar compra (draft → confirmed).

#### `POST /api/purchases/:id/receive`
Recibir compra (confirmed → received).  
**Operación crítica:** Actualiza stock, costos y caja.

**Body opcional:**
```json
{
  "paymentMethod": "transfer" // "cash" | "transfer"
}
```

**Response incluye:**
```json
{
  ...purchase,
  "stockUpdates": [
    {
      "productId": "uuid",
      "quantity": 10,
      "unitCost": 1500.00,
      "success": true
    }
  ]
}
```

---

## 🔐 Seguridad y Validaciones

### Autenticación
- ✅ Todos los endpoints requieren Bearer token
- ✅ Validación de usuario con Supabase Auth

### Multi-tenant
- ✅ Todas las operaciones filtradas por `tenant_id`
- ✅ Validación de pertenencia al tenant

### Validaciones Zod
- ✅ `createSupplierSchema`
- ✅ `updateSupplierSchema`
- ✅ `createPurchaseSchema`
- ✅ `updatePurchaseSchema`

### Reglas de Negocio
- ✅ No eliminar proveedor con compras
- ✅ Solo editar compras en `draft`
- ✅ Solo recibir compras en `confirmed`
- ✅ No cancelar compras `received`

---

## 📊 Integración con Sistema Existente

### Ventas
- ✅ El costo del producto se usa como default en nuevas ventas
- ✅ Permite override manual del costo
- ✅ Snapshot inmutable en `sale_items.unit_cost`
- ✅ Cálculo de margen sigue funcionando igual

### Stock
- ✅ Movimientos de stock con referencia a compras
- ✅ Trazabilidad completa: compra → stock → venta

### Caja Diaria
- ✅ Compras generan movimientos tipo `expense`
- ✅ Solo si hay caja abierta
- ✅ Trazabilidad con `purchase_id`

---

## 🧪 Testing Sugerido

### Flujo Completo

1. **Crear proveedor:**
   ```bash
   POST /api/suppliers
   {
     "name": "Proveedor Test",
     "email": "test@proveedor.com"
   }
   ```

2. **Crear compra:**
   ```bash
   POST /api/purchases
   {
     "supplierId": "...",
     "items": [
       {
         "productId": "...",
         "quantity": 10,
         "unitCost": "1000.00"
       }
     ]
   }
   ```

3. **Confirmar compra:**
   ```bash
   POST /api/purchases/:id/confirm
   ```

4. **Recibir compra:**
   ```bash
   POST /api/purchases/:id/receive
   {
     "paymentMethod": "transfer"
   }
   ```

5. **Verificar:**
   - ✅ Stock del producto actualizado
   - ✅ Costo del producto actualizado (promedio ponderado)
   - ✅ Movimiento de stock creado
   - ✅ Movimiento de caja creado (si hay caja abierta)

---

## ⚠️ Consideraciones Importantes

### Edge Cases

1. **Producto sin costo previo:**
   - Usa el costo de la compra directamente
   - No calcula promedio

2. **Compras parciales:**
   - No implementado en este sprint
   - Cada compra se recibe completa

3. **Rollback en errores:**
   - Si falla la actualización de algún producto, la compra no se marca como `received`
   - El usuario puede intentar de nuevo

4. **Caja cerrada:**
   - La compra se recibe normalmente
   - El movimiento de caja no se crea
   - Se puede crear manualmente después

### Compatibilidad

- ✅ **No rompe ventas existentes**
- ✅ **No elimina snapshot de costos en sale_items**
- ✅ **Productos sin costo inicial son válidos**
- ✅ **Todo es multi-tenant**

---

## 📝 Archivos Creados/Modificados

### Nuevos Archivos

- `src/db/schema.ts` (actualizado con nuevas tablas)
- `src/validations/supplier.ts`
- `src/validations/purchase.ts`
- `src/lib/purchase-helpers.ts`
- `src/app/api/suppliers/route.ts`
- `src/app/api/suppliers/[id]/route.ts`
- `src/app/api/purchases/route.ts`
- `src/app/api/purchases/[id]/route.ts`
- `src/app/api/purchases/[id]/confirm/route.ts`
- `src/app/api/purchases/[id]/receive/route.ts`
- `migrations/sprint_erp_suppliers_purchases.sql`

### Archivos Modificados

- `src/db/schema.ts` (agregado `products.cost`, extensiones a `stock_movements` y `cash_movements`)
- `src/lib/sale-helpers.ts` (actualizado `prepareSaleItems` para usar costo del producto como default)

---

## 🎯 Próximos Pasos (Futuro)

1. **Reportes de Margen:**
   - Margen por producto
   - Margen por período
   - Margen por categoría

2. **Compras Parciales:**
   - Recibir items individuales
   - Tracking de recepción parcial

3. **Integración Fiscal:**
   - Facturas de compra
   - Comprobantes AFIP

4. **Órdenes de Compra:**
   - Pre-ordenar antes de recibir
   - Tracking de órdenes pendientes

---

## ✅ Checklist de Implementación

- [x] Schema de base de datos diseñado
- [x] Migración SQL creada
- [x] Validaciones Zod implementadas
- [x] Endpoints CRUD de proveedores
- [x] Endpoints CRUD de compras
- [x] Lógica de confirmación de compras
- [x] Lógica de recepción de compras
- [x] Cálculo de costo promedio ponderado
- [x] Actualización automática de stock
- [x] Actualización automática de costos
- [x] Integración con caja diaria
- [x] Trazabilidad completa
- [x] Documentación completa

---

**Estado:** ✅ **SPRINT COMPLETADO**  
**Fecha:** Diciembre 2024
