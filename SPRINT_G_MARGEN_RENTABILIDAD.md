# 🚀 SPRINT G — Margen & Rentabilidad

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Dar visibilidad clara y práctica sobre rentabilidad, permitiendo al comerciante responder:

- ✅ ¿Cuánto gano por venta?
- ✅ ¿Qué productos me dejan margen?
- ✅ ¿Estoy vendiendo mucho pero ganando poco?

**Enfoque:** Margen bruto operativo (no contabilidad legal, no impuestos, no AFIP)

---

## 📦 Alcance del Sprint

### ✅ INCLUYE

- ✅ Margen por venta
- ✅ Margen por producto
- ✅ Reportes simples de rentabilidad
- ✅ Visualización clara (no técnica)

### ❌ NO INCLUYE

- ❌ Contabilidad legal
- ❌ Costos indirectos
- ❌ Gastos generales
- ❌ Impuestos
- ❌ Multi-moneda

---

## 🔧 Backend — Implementación

### G.B1 — Normalizar respuesta de margen en ventas ✅

**Endpoint:** `GET /api/sales/:id`

**Mejoras implementadas:**

1. **Nombres normalizados:**
   - `marginAmount` (en lugar de solo `margin`)
   - `marginPercent` (en lugar de solo `marginPercentage`)
   - Backward compatibility: mantiene `margin` y `marginPercentage`

2. **Margen por item:**
   - Cada item en `sale_items` ahora incluye:
     - `itemMargin`: Margen del item (revenue - cost)
     - `itemMarginPercent`: Porcentaje de margen del item

**Estructura de respuesta:**

```json
{
  "id": "sale-uuid",
  "status": "confirmed",
  "total_amount": "12000.00",
  "cost_amount": "8000.00",
  "financial": {
    "totalAmount": 12000,
    "costAmount": 8000,
    "marginAmount": 4000,
    "marginPercent": 33.33,
    "margin": 4000, // Backward compatibility
    "marginPercentage": 33.33 // Backward compatibility
  },
  "sale_items": [
    {
      "id": "item-uuid",
      "productName": "Remera",
      "quantity": 2,
      "unitPrice": "6000.00",
      "unitCost": "4000.00",
      "subtotal": "12000.00",
      "itemMargin": 2000,
      "itemMarginPercent": 33.33
    }
  ]
}
```

---

### G.B2 — Reporte de margen por producto ✅

**Endpoint:** `GET /api/reports/product-margins`

**Query params:**
- `from` (opcional): Fecha de inicio en formato `YYYY-MM-DD`
- `to` (opcional): Fecha de fin en formato `YYYY-MM-DD`
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)

**Ejemplo de uso:**
```
GET /api/reports/product-margins?from=2024-01-01&to=2024-12-31
```

**Respuesta:**

```json
[
  {
    "productId": "product-uuid",
    "productName": "Remera",
    "productSku": "REM-001",
    "totalSold": 40,
    "revenue": 240000,
    "cost": 160000,
    "margin": 80000,
    "marginPercent": 33.3
  },
  {
    "productId": "product-uuid-2",
    "productName": "Pantalón",
    "productSku": "PAN-001",
    "totalSold": 25,
    "revenue": 150000,
    "cost": 120000,
    "margin": 30000,
    "marginPercent": 20.0
  }
]
```

**Características:**
- ✅ Solo incluye ventas `confirmed` o `paid`
- ✅ Agrupa por producto
- ✅ Calcula totales: cantidad vendida, ingresos, costos, margen
- ✅ Ordenado por margen descendente (productos más rentables primero)
- ✅ Filtrado por rango de fechas opcional

---

## 📊 Cálculos de Margen

### Margen por Venta

```
marginAmount = totalAmount - costAmount
marginPercent = (marginAmount / totalAmount) * 100
```

### Margen por Item

```
itemRevenue = unitPrice * quantity
itemCost = unitCost * quantity
itemMargin = itemRevenue - itemCost
itemMarginPercent = (itemMargin / itemRevenue) * 100
```

### Margen por Producto (Reporte)

```
revenue = suma de todos los subtotales del producto
cost = suma de todos los costos del producto
margin = revenue - cost
marginPercent = (margin / revenue) * 100
```

---

## 🔐 Seguridad

- ✅ Todos los endpoints requieren autenticación Bearer token
- ✅ Multi-tenant: filtrado por `tenant_id`
- ✅ Solo ventas confirmadas/pagadas se incluyen en reportes

---

## 📡 Endpoints Disponibles

### 1. GET /api/sales/:id
**Mejorado:** Ahora incluye margen por item y nombres normalizados

**Response incluye:**
- `financial.marginAmount` - Margen total de la venta
- `financial.marginPercent` - Porcentaje de margen
- `sale_items[].itemMargin` - Margen de cada item
- `sale_items[].itemMarginPercent` - Porcentaje de margen de cada item

### 2. GET /api/reports/product-margins
**Nuevo:** Reporte de margen por producto

**Query params:**
- `from` (opcional): `YYYY-MM-DD`
- `to` (opcional): `YYYY-MM-DD`
- `tenantId` (opcional)

**Response:**
- Array de productos con sus márgenes
- Ordenado por margen descendente

---

## 🧪 Testing

### Probar margen por venta:

```bash
GET /api/sales/{sale-id}
Authorization: Bearer {token}

# Verificar que la respuesta incluye:
# - financial.marginAmount
# - financial.marginPercent
# - sale_items[].itemMargin
# - sale_items[].itemMarginPercent
```

### Probar reporte de margen por producto:

```bash
GET /api/reports/product-margins?from=2024-01-01&to=2024-12-31
Authorization: Bearer {token}

# Verificar que devuelve array de productos con:
# - productId, productName, productSku
# - totalSold, revenue, cost
# - margin, marginPercent
```

---

## 📝 Archivos Creados/Modificados

### Nuevos Archivos

- `src/lib/margin-helpers.ts` - Helper para cálculo de margen por producto
- `src/app/api/reports/product-margins/route.ts` - Endpoint de reporte

### Archivos Modificados

- `src/app/api/sales/[id]/route.ts` - Mejorado para incluir margen por item y nombres normalizados

---

## ✅ Checklist de Implementación

- [x] Endpoint GET /api/sales/:id mejorado
- [x] Margen por item incluido en respuesta
- [x] Nombres normalizados (marginAmount, marginPercent)
- [x] Backward compatibility mantenida
- [x] Helper para cálculo de margen por producto
- [x] Endpoint GET /api/reports/product-margins creado
- [x] Filtrado por rango de fechas
- [x] Ordenamiento por margen descendente
- [x] Multi-tenant respetado
- [x] Autenticación requerida

---

## 🎯 Próximos Pasos (Frontend)

### Visualización de Margen por Venta

- Mostrar `marginAmount` y `marginPercent` en detalle de venta
- Tabla de items con `itemMargin` y `itemMarginPercent`
- Indicadores visuales (verde para buen margen, rojo para bajo)

### Reporte de Margen por Producto

- Tabla con todos los productos y sus márgenes
- Filtros por fecha
- Ordenamiento (por defecto: margen descendente)
- Gráficos opcionales (barras, líneas)

### Dashboard de Rentabilidad

- Resumen general de márgenes
- Top productos más rentables
- Productos con bajo margen (alertas)
- Tendencias de margen en el tiempo

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Obtener margen de una venta

```typescript
const response = await fetch(`/api/sales/${saleId}`, {
  headers: { Authorization: `Bearer ${token}` }
});

const sale = await response.json();

console.log(`Margen total: $${sale.financial.marginAmount}`);
console.log(`Margen porcentual: ${sale.financial.marginPercent}%`);

sale.sale_items.forEach(item => {
  console.log(`${item.productName}: $${item.itemMargin} (${item.itemMarginPercent}%)`);
});
```

### Ejemplo 2: Obtener reporte de margen por producto

```typescript
const response = await fetch(
  `/api/reports/product-margins?from=2024-01-01&to=2024-12-31`,
  { headers: { Authorization: `Bearer ${token}` } }
);

const products = await response.json();

products.forEach(product => {
  console.log(`${product.productName}:`);
  console.log(`  Vendidos: ${product.totalSold}`);
  console.log(`  Ingresos: $${product.revenue}`);
  console.log(`  Costos: $${product.cost}`);
  console.log(`  Margen: $${product.margin} (${product.marginPercent}%)`);
});
```

---

## ⚠️ Consideraciones Importantes

### Productos sin Costo

- Si un producto no tiene `unit_cost` en la venta, se considera `0`
- El margen será igual al revenue (100% de margen)
- **Recomendación:** Asegurar que todos los productos tengan costo antes de calcular márgenes

### Ventas sin Costo

- Si `cost_amount` es `0` o `NULL`, el margen será igual al `total_amount`
- Esto puede indicar que la venta fue creada antes de implementar costos

### Precisión Decimal

- Todos los valores se redondean a 2 decimales
- Los porcentajes se redondean a 2 decimales

---

## 🎉 Estado Final

**✅ SPRINT G COMPLETADO**

- ✅ Backend implementado
- ✅ Endpoints funcionando
- ✅ Cálculos correctos
- ✅ Documentación completa

**Listo para:**
- ✅ Integración con frontend
- ✅ Visualización de márgenes
- ✅ Reportes de rentabilidad

---

**Fecha:** Diciembre 2024  
**Siguiente paso:** Implementar frontend para visualización de márgenes
