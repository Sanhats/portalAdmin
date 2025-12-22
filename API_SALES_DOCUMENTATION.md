# 📦 API de Ventas - Documentación para Frontend

**Estado:** ✅ **COMPLETADO Y PROBADO**  
**Fecha:** Diciembre 2024  
**Base URL:** `http://localhost:3000/api` (desarrollo) / `https://tu-proyecto.vercel.app/api` (producción)

---

## 📋 Tabla de Contenidos

1. [Autenticación](#autenticación)
2. [Endpoints de Ventas](#endpoints-de-ventas)
3. [Estados de Venta](#estados-de-venta)
4. [Flujo de Stock](#flujo-de-stock)
5. [Validaciones](#validaciones)
6. [Códigos de Error](#códigos-de-error)
7. [Ejemplos Completos](#ejemplos-completos)

---

## 🔐 Autenticación

**Todos los endpoints de ventas requieren autenticación.**

### Headers Requeridos

```typescript
{
  "Authorization": "Bearer {access_token}",
  "Content-Type": "application/json"
}
```

### Obtener Token

```typescript
// POST /api/auth/login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const data = await response.json();
const token = data.session.access_token;
```

---

## 📦 Endpoints de Ventas

### 1. Crear Venta (Draft)

**Endpoint:** `POST /api/sales`

**Descripción:** Crea una nueva venta en estado `draft`. **NO descuenta stock** hasta que se confirme.

**Request Body:**
```typescript
{
  tenantId?: string;        // Opcional: UUID del tenant (store). Si no se envía, usa store por defecto
  items: Array<{
    productId: string;      // UUID del producto (requerido)
    variantId?: string;     // UUID de la variante (opcional, nullable)
    quantity: number;       // Cantidad (entero positivo, requerido)
    unitPrice: number | string; // Precio unitario (requerido)
  }>;
  paymentMethod?: 'cash' | 'transfer' | 'mercadopago' | 'other'; // Opcional
  notes?: string;           // Notas adicionales (máx 5000 caracteres, opcional)
}
```

**Response 201:**
```typescript
{
  id: string;              // UUID de la venta
  tenant_id: string;
  status: 'draft';
  total_amount: string;    // Total calculado automáticamente
  payment_method: string | null;
  notes: string | null;
  created_by: string;      // UUID del usuario que creó la venta
  payment_status: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
  sale_items: Array<{
    id: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_price: string;
    subtotal: string;
    products: {
      id: string;
      sku: string;
      name_internal: string;
      price: string;
    };
    variants: {
      id: string;
      name: string;
      value: string;
    } | null;
  }>;
}
```

**Ejemplo:**
```typescript
const sale = await fetch('http://localhost:3000/api/sales', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [
      {
        productId: 'uuid-del-producto',
        quantity: 2,
        unitPrice: 150
      }
    ],
    paymentMethod: 'cash',
    notes: 'Venta de prueba'
  })
});
```

**Validaciones:**
- ✅ Debe incluir al menos un item
- ✅ Productos deben existir y estar activos
- ✅ Variantes deben existir y pertenecer al producto correcto
- ✅ Stock NO se descuenta en draft

---

### 2. Listar Ventas

**Endpoint:** `GET /api/sales`

**Descripción:** Obtiene la lista de ventas con paginación y filtros.

**Query Parameters:**
```typescript
{
  page?: number;           // Número de página (default: 1)
  limit?: number;          // Items por página (default: 50, máx: 100)
  status?: 'draft' | 'confirmed' | 'cancelled' | 'paid'; // Filtrar por estado
  tenantId?: string;       // Filtrar por tenant (opcional)
}
```

**Response 200:**
```typescript
{
  data: Array<Sale>;      // Array de ventas (mismo formato que POST)
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Ejemplo:**
```typescript
const sales = await fetch('http://localhost:3000/api/sales?page=1&limit=10&status=draft', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

### 3. Obtener Venta por ID

**Endpoint:** `GET /api/sales/:id`

**Descripción:** Obtiene los detalles completos de una venta específica.

**Response 200:**
```typescript
// Mismo formato que POST /api/sales
{
  id: string;
  tenant_id: string;
  status: 'draft' | 'confirmed' | 'cancelled' | 'paid';
  total_amount: string;
  payment_method: string | null;
  notes: string | null;
  created_by: string;
  payment_status: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
  sale_items: Array<SaleItem>;
}
```

**Ejemplo:**
```typescript
const sale = await fetch(`http://localhost:3000/api/sales/${saleId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Errores:**
- `404`: Venta no encontrada

---

### 4. Editar Venta

**Endpoint:** `PUT /api/sales/:id`

**Descripción:** Edita una venta. **Solo se puede editar si está en estado `draft`**.

**Request Body:**
```typescript
{
  items?: Array<{          // Opcional: actualizar items (recalcula total)
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number | string;
  }>;
  paymentMethod?: 'cash' | 'transfer' | 'mercadopago' | 'other';
  notes?: string;
}
```

**Response 200:**
```typescript
// Mismo formato que GET /api/sales/:id
```

**Ejemplo:**
```typescript
const updatedSale = await fetch(`http://localhost:3000/api/sales/${saleId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notes: 'Notas actualizadas',
    paymentMethod: 'transfer'
  })
});
```

**Validaciones:**
- ✅ Solo se puede editar si `status === 'draft'`
- ✅ Si se actualizan items, se valida stock (pero NO se descuenta hasta confirmar)
- ✅ Si se actualizan items, se recalcula el total automáticamente

**Errores:**
- `400`: Venta no está en estado draft
- `404`: Venta no encontrada

---

### 5. Confirmar Venta

**Endpoint:** `POST /api/sales/:id/confirm`

**Descripción:** Confirma una venta y **descuenta el stock** de los productos. Solo funciona si está en estado `draft`.

**Request Body:** Ninguno (usa el ID de la venta)

**Response 200:**
```typescript
// Mismo formato que GET /api/sales/:id, pero con status: 'confirmed'
{
  // ... campos de venta ...
  status: 'confirmed';
  sale_items: Array<SaleItem>;
}
```

**Ejemplo:**
```typescript
const confirmedSale = await fetch(`http://localhost:3000/api/sales/${saleId}/confirm`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Validaciones:**
- ✅ Solo se puede confirmar si `status === 'draft'`
- ✅ Valida que haya stock suficiente para todos los items
- ✅ Descuenta stock de cada producto
- ✅ Registra movimientos en `stock_movements`

**Errores:**
- `400`: Venta no está en estado draft
- `400`: Stock insuficiente (detalles en `details.issues`)
- `404`: Venta no encontrada

**Ejemplo de error de stock insuficiente:**
```typescript
{
  error: "Stock insuficiente",
  details: {
    issues: [
      "Producto PROD-001: stock disponible 5, solicitado 10"
    ],
    message: "No hay stock suficiente para confirmar la venta"
  }
}
```

---

### 6. Cancelar Venta

**Endpoint:** `POST /api/sales/:id/cancel`

**Descripción:** Cancela una venta. Si estaba `confirmed`, **revierte el stock**. Solo funciona si está en `draft` o `confirmed`.

**Request Body:** Ninguno (usa el ID de la venta)

**Response 200:**
```typescript
// Mismo formato que GET /api/sales/:id, pero con status: 'cancelled'
{
  // ... campos de venta ...
  status: 'cancelled';
  sale_items: Array<SaleItem>;
}
```

**Ejemplo:**
```typescript
const cancelledSale = await fetch(`http://localhost:3000/api/sales/${saleId}/cancel`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Validaciones:**
- ✅ Solo se puede cancelar si `status === 'draft'` o `status === 'confirmed'`
- ✅ Si estaba `confirmed`, revierte el stock
- ✅ Si estaba `draft`, no hace nada con el stock (ya que no se había descontado)
- ✅ Registra movimientos en `stock_movements` si revierte stock

**Errores:**
- `400`: Venta ya está cancelada
- `400`: No se puede cancelar una venta pagada (debe procesarse reembolso primero)
- `404`: Venta no encontrada

---

## 🔄 Estados de Venta

| Estado | Descripción | Stock | Editable | Confirmable | Cancelable |
|--------|------------|-------|----------|-------------|------------|
| `draft` | Borrador | ❌ NO descontado | ✅ Sí | ✅ Sí | ✅ Sí |
| `confirmed` | Confirmada | ✅ Descontado | ❌ No | ❌ No | ✅ Sí |
| `cancelled` | Cancelada | 🔄 Revertido (si estaba confirmed) | ❌ No | ❌ No | ❌ No |
| `paid` | Pagada | ✅ Descontado | ❌ No | ❌ No | ❌ No* |

*Nota: Las ventas pagadas no se pueden cancelar directamente. Debe procesarse un reembolso primero.

---

## 📊 Flujo de Stock

### Reglas de Stock

1. **Draft (Borrador)**
   - ❌ **NO descuenta stock**
   - El stock permanece igual
   - Se puede editar libremente

2. **Confirmed (Confirmada)**
   - ✅ **Descuenta stock** al confirmar
   - Valida stock suficiente antes de confirmar
   - Registra movimiento en `stock_movements`
   - Ya no se puede editar

3. **Cancelled (Cancelada)**
   - 🔄 **Revierte stock** si estaba confirmed
   - Si estaba draft, no hace nada (no había descontado)
   - Registra movimiento de reversión en `stock_movements`

### Ejemplo de Flujo

```
Stock inicial: 23 unidades

1. Crear venta (draft) - 2 unidades
   Stock: 23 (sin cambios) ✅

2. Confirmar venta
   Stock: 21 (descontado 2) ✅

3. Cancelar venta
   Stock: 23 (revertido 2) ✅
```

---

## ✅ Validaciones

### Validaciones de Items

- ✅ Debe incluir al menos un item
- ✅ `productId` debe ser un UUID válido
- ✅ `variantId` debe ser un UUID válido (si se proporciona)
- ✅ `quantity` debe ser un entero positivo (> 0)
- ✅ `unitPrice` debe ser un número positivo

### Validaciones de Productos

- ✅ Productos deben existir en la base de datos
- ✅ Productos deben estar activos (`is_active = true`)
- ✅ Productos no deben estar eliminados (soft delete)
- ✅ Variantes deben existir y pertenecer al producto correcto

### Validaciones de Stock

- ✅ Al confirmar: valida stock suficiente para todos los items
- ✅ Si falta stock, retorna error con detalles de qué productos tienen stock insuficiente

### Validaciones de Estado

- ✅ Solo se puede editar si `status === 'draft'`
- ✅ Solo se puede confirmar si `status === 'draft'`
- ✅ Solo se puede cancelar si `status === 'draft'` o `status === 'confirmed'`
- ✅ No se puede cancelar si `status === 'paid'`

---

## 🚨 Códigos de Error

### 400 Bad Request

**Causas comunes:**
- Datos inválidos (validación Zod fallida)
- Venta no está en estado correcto para la operación
- Stock insuficiente (al confirmar)
- Items vacíos o inválidos

**Ejemplo:**
```typescript
{
  error: "Datos inválidos",
  details: [
    {
      path: ["items", 0, "quantity"],
      message: "La cantidad debe ser mayor a 0"
    }
  ]
}
```

### 401 Unauthorized

**Causas:**
- Token no proporcionado
- Token inválido o expirado

**Solución:**
- Obtener nuevo token con `/api/auth/login`

### 404 Not Found

**Causas:**
- Venta no encontrada
- Producto no encontrado
- Variante no encontrada

### 500 Internal Server Error

**Causas:**
- Error del servidor
- Error de base de datos

---

## 💡 Ejemplos Completos

### Flujo Completo: Crear → Editar → Confirmar → Cancelar

```typescript
// 1. Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});
const { session } = await loginResponse.json();
const token = session.access_token;

// 2. Crear venta (draft)
const newSale = await fetch('http://localhost:3000/api/sales', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [
      {
        productId: 'uuid-del-producto',
        quantity: 2,
        unitPrice: 150
      }
    ],
    paymentMethod: 'cash',
    notes: 'Venta de prueba'
  })
});
const sale = await newSale.json();
const saleId = sale.id;

// 3. Editar venta (solo si está en draft)
const updatedSale = await fetch(`http://localhost:3000/api/sales/${saleId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notes: 'Notas actualizadas',
    paymentMethod: 'transfer'
  })
});

// 4. Confirmar venta (descuenta stock)
const confirmedSale = await fetch(`http://localhost:3000/api/sales/${saleId}/confirm`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 5. Cancelar venta (revierte stock si estaba confirmed)
const cancelledSale = await fetch(`http://localhost:3000/api/sales/${saleId}/cancel`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Listar Ventas con Filtros

```typescript
// Listar todas las ventas en draft
const draftSales = await fetch('http://localhost:3000/api/sales?status=draft&page=1&limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Listar ventas confirmadas
const confirmedSales = await fetch('http://localhost:3000/api/sales?status=confirmed', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Manejo de Errores

```typescript
try {
  const response = await fetch(`http://localhost:3000/api/sales/${saleId}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 400 && error.details?.issues) {
      // Error de stock insuficiente
      console.error('Stock insuficiente:', error.details.issues);
    } else if (response.status === 400) {
      // Error de estado (venta no está en draft)
      console.error('No se puede confirmar:', error.error);
    } else if (response.status === 404) {
      // Venta no encontrada
      console.error('Venta no encontrada');
    }
    
    throw new Error(error.error);
  }

  const sale = await response.json();
  console.log('Venta confirmada:', sale);
} catch (error) {
  console.error('Error:', error);
}
```

---

## 📝 Notas Importantes

1. **Multi-tenant:** Todas las ventas están aisladas por `tenant_id`. Si no se proporciona, usa el store por defecto.

2. **Stock:** El stock solo se descuenta al confirmar, no al crear en draft.

3. **Transacciones:** Las operaciones de stock son seguras y registran movimientos en `stock_movements`.

4. **Mercado Pago:** Los campos `payment_status` y `external_reference` están preparados para integración futura con Mercado Pago.

5. **Soft Delete:** Los productos eliminados (soft delete) no aparecen en las validaciones.

6. **Productos Activos:** Solo se pueden vender productos con `is_active = true`.

---

## 🎯 Checklist de Implementación Frontend

- [ ] Integrar autenticación (obtener token)
- [ ] Crear componente/formulario para crear venta
- [ ] Listar ventas con paginación
- [ ] Mostrar detalles de venta
- [ ] Permitir editar venta (solo draft)
- [ ] Botón para confirmar venta
- [ ] Botón para cancelar venta
- [ ] Manejo de errores (stock insuficiente, etc.)
- [ ] Indicadores de estado (draft, confirmed, cancelled)
- [ ] Validación de formularios
- [ ] Actualización de stock en tiempo real (opcional)

---

## ✅ Estado del Sistema

**✅ COMPLETADO Y PROBADO**

- ✅ Todos los endpoints implementados
- ✅ Validaciones funcionando
- ✅ Flujo de stock verificado
- ✅ Reglas de negocio aplicadas
- ✅ Pruebas exitosas

**Listo para integración con frontend** 🚀

