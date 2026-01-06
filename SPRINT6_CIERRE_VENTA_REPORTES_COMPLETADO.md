# ✅ SPRINT 6 — CIERRE DE VENTA + REPORTES - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Proporcionar reportes confiables para que el negocio confíe en los números mediante resúmenes de ventas, caja diaria y diferencias.

---

## ✅ Tareas Implementadas

### 1. **Resumen: Ventas por Método de Pago**

#### ✅ **Endpoint GET /api/reports/sales-by-method**

**Descripción:** Obtiene un resumen de ventas agrupadas por método de pago

**Query Parameters:**
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)
- `startDate` (opcional): Fecha de inicio (ISO 8601)
- `endDate` (opcional): Fecha de fin (ISO 8601)

**Response 200:**
```json
{
  "byMethod": [
    {
      "method": "cash",
      "provider": "manual",
      "totalAmount": 5000.00,
      "totalSales": 10,
      "averageAmount": 500.00
    },
    {
      "method": "transfer",
      "provider": "banco",
      "totalAmount": 3000.00,
      "totalSales": 5,
      "averageAmount": 600.00
    },
    {
      "method": "mp_point",
      "provider": "mercadopago",
      "totalAmount": 2000.00,
      "totalSales": 3,
      "averageAmount": 666.67
    }
  ],
  "total": {
    "totalAmount": 10000.00,
    "totalSales": 18
  }
}
```

**Características:**
- ✅ Agrupa por método y proveedor
- ✅ Calcula totales, cantidad de ventas y promedio
- ✅ Ordena por monto total descendente
- ✅ Solo incluye pagos confirmados
- ✅ Soporta filtros de fecha opcionales

---

### 2. **Resumen: Caja Diaria**

#### ✅ **Endpoint GET /api/reports/daily-cash**

**Descripción:** Obtiene el resumen de caja del día (ventas y pagos)

**Query Parameters:**
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)
- `date` (opcional): Fecha del día (YYYY-MM-DD, default: hoy)

**Response 200:**
```json
{
  "date": "2024-12-01",
  "sales": {
    "total": 25,
    "confirmed": 15,
    "paid": 8,
    "cancelled": 2
  },
  "payments": {
    "totalAmount": 12000.00,
    "byMethod": [
      {
        "method": "cash",
        "provider": "manual",
        "amount": 5000.00,
        "count": 10
      },
      {
        "method": "transfer",
        "provider": "banco",
        "amount": 4000.00,
        "count": 5
      },
      {
        "method": "mp_point",
        "provider": "mercadopago",
        "amount": 3000.00,
        "count": 3
      }
    ]
  },
  "financial": {
    "totalSales": 15000.00,
    "totalPaid": 12000.00,
    "pendingAmount": 3000.00,
    "cancelledAmount": 500.00
  }
}
```

**Características:**
- ✅ Resumen de ventas por estado (total, confirmed, paid, cancelled)
- ✅ Resumen de pagos por método
- ✅ Totales financieros (ventas, pagos, pendientes, cancelados)
- ✅ Filtro por fecha (default: día actual)
- ✅ Solo incluye pagos confirmados

---

### 3. **Resumen: Diferencias**

#### ✅ **Endpoint GET /api/reports/differences**

**Descripción:** Obtiene diferencias entre ventas y pagos (para detectar inconsistencias)

**Query Parameters:**
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)
- `startDate` (opcional): Fecha de inicio (ISO 8601)
- `endDate` (opcional): Fecha de fin (ISO 8601)

**Response 200:**
```json
{
  "period": {
    "startDate": "2024-12-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.999Z"
  },
  "sales": {
    "totalAmount": 50000.00,
    "totalSales": 50,
    "byStatus": {
      "confirmed": 20,
      "paid": 25,
      "cancelled": 5
    }
  },
  "payments": {
    "totalAmount": 48000.00,
    "totalPayments": 45,
    "byMethod": [
      {
        "method": "cash",
        "provider": "manual",
        "amount": 25000.00,
        "count": 20
      },
      {
        "method": "transfer",
        "provider": "banco",
        "amount": 15000.00,
        "count": 15
      },
      {
        "method": "mp_point",
        "provider": "mercadopago",
        "amount": 8000.00,
        "count": 10
      }
    ]
  },
  "differences": {
    "totalDifference": 2000.00,
    "pendingSales": 2000.00,
    "overPayments": 0.00,
    "breakdown": [
      {
        "saleId": "uuid-1",
        "saleAmount": 1000.00,
        "paidAmount": 500.00,
        "difference": 500.00,
        "status": "confirmed"
      },
      {
        "saleId": "uuid-2",
        "saleAmount": 1500.00,
        "paidAmount": 1500.00,
        "difference": 0.00,
        "status": "paid"
      }
    ]
  }
}
```

**Características:**
- ✅ Compara ventas vs pagos
- ✅ Calcula diferencia total
- ✅ Identifica ventas pendientes (sin pagar completamente)
- ✅ Identifica sobrepagos (pagos mayores al monto de la venta)
- ✅ Breakdown detallado por venta (limitado a 100 para rendimiento)
- ✅ Ordena por diferencia absoluta descendente

---

## 🔧 Archivos Creados/Modificados

### **Archivos Creados:**
- ✅ `src/lib/report-helpers.ts` - Funciones helper para cálculos de reportes
- ✅ `src/validations/report.ts` - Validaciones Zod para parámetros de reportes
- ✅ `src/app/api/reports/sales-by-method/route.ts` - Endpoint de ventas por método
- ✅ `src/app/api/reports/daily-cash/route.ts` - Endpoint de caja diaria
- ✅ `src/app/api/reports/differences/route.ts` - Endpoint de diferencias

---

## ✅ Criterios de Aceptación

### ✅ **Ventas por Método**
- ✅ Agrupa ventas por método de pago
- ✅ Incluye proveedor (manual, mercadopago, banco, pos)
- ✅ Calcula totales, cantidad y promedio
- ✅ Soporta filtros de fecha
- ✅ Solo incluye pagos confirmados

### ✅ **Caja Diaria**
- ✅ Resumen del día (ventas y pagos)
- ✅ Desglose por método de pago
- ✅ Totales financieros (ventas, pagos, pendientes, cancelados)
- ✅ Filtro por fecha (default: hoy)

### ✅ **Diferencias**
- ✅ Compara ventas vs pagos
- ✅ Identifica ventas pendientes
- ✅ Identifica sobrepagos
- ✅ Breakdown detallado por venta
- ✅ Soporta filtros de fecha

---

## 📊 Ejemplos de Uso

### **Ejemplo 1: Ventas por Método (Último Mes)**

```typescript
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1);

const response = await fetch(
  `/api/reports/sales-by-method?startDate=${startDate.toISOString()}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const report = await response.json();
// report.byMethod contiene ventas agrupadas por método
// report.total contiene totales generales
```

### **Ejemplo 2: Caja Diaria (Hoy)**

```typescript
const response = await fetch('/api/reports/daily-cash', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const report = await response.json();
// report.sales contiene resumen de ventas
// report.payments contiene resumen de pagos
// report.financial contiene totales financieros
```

### **Ejemplo 3: Caja Diaria (Fecha Específica)**

```typescript
const response = await fetch('/api/reports/daily-cash?date=2024-12-01', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const report = await response.json();
```

### **Ejemplo 4: Diferencias (Rango de Fechas)**

```typescript
const startDate = '2024-12-01T00:00:00.000Z';
const endDate = '2024-12-31T23:59:59.999Z';

const response = await fetch(
  `/api/reports/differences?startDate=${startDate}&endDate=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const report = await response.json();
// report.differences contiene diferencias y breakdown
```

---

## 📝 Notas Técnicas

### **Filtros de Fecha**
- Formato: ISO 8601 (ej: `2024-12-01T00:00:00.000Z`)
- Para caja diaria: formato YYYY-MM-DD (ej: `2024-12-01`)
- Si no se proporciona fecha, se usa el día actual para caja diaria
- Si no se proporcionan fechas en otros reportes, se incluyen todos los registros

### **Cálculos**
- Todos los montos se redondean a 2 decimales
- Solo se incluyen pagos con `status = 'confirmed'`
- Las ventas se filtran por estados: `confirmed`, `paid`, `cancelled`

### **Rendimiento**
- El breakdown de diferencias está limitado a 100 registros
- Los reportes usan agregaciones en memoria (optimizable con vistas SQL en el futuro)

---

## 🎯 Casos de Uso

### **Caso 1: Cierre Diario**
```
1. GET /api/reports/daily-cash?date=2024-12-01
2. Revisar report.financial.totalPaid
3. Comparar con caja física
4. Identificar diferencias con GET /api/reports/differences
```

### **Caso 2: Análisis de Métodos de Pago**
```
1. GET /api/reports/sales-by-method?startDate=2024-12-01T00:00:00.000Z
2. Analizar report.byMethod para ver qué métodos generan más ventas
3. Tomar decisiones sobre promoción de métodos
```

### **Caso 3: Detección de Inconsistencias**
```
1. GET /api/reports/differences?startDate=2024-12-01T00:00:00.000Z
2. Revisar report.differences.breakdown
3. Identificar ventas con diferencias significativas
4. Investigar y corregir
```

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRUEBAS**

