# 🔍 Guía de Verificación de Integración Frontend-Backend

**Sistema de Pagos Internos - Checklist de Integración**

Esta guía te ayudará a verificar si tu frontend está usando correctamente todas las nuevas funcionalidades del sistema de pagos.

---

## 🚀 Verificación Rápida

### Ejecutar Script de Verificación

```powershell
# Desde el directorio del proyecto backend
.\verificar-integracion-frontend.ps1
```

Este script verifica automáticamente:
- ✅ Endpoints de métodos de pago
- ✅ Resumen financiero en ventas
- ✅ Endpoints de pagos
- ✅ Estados de pago
- ✅ Campos de gateway (external_reference, gateway_metadata)

---

## 📋 Checklist Manual para Frontend

### 1. Métodos de Pago Configurables

#### ✅ GET /api/payment-methods

**¿Tu frontend obtiene métodos de pago configurables?**

```typescript
// Ejemplo correcto
const response = await fetch('/api/payment-methods', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const methods = await response.json();

// Debe incluir:
// - id, label, code, type, is_active, metadata
// - Filtros: ?type=qr, ?isActive=true
```

**Verificar:**
- [ ] El frontend llama a `/api/payment-methods`
- [ ] Muestra métodos activos filtrados por tipo
- [ ] Permite seleccionar método de pago desde la lista

#### ✅ POST /api/payment-methods

**¿Tu frontend permite crear métodos de pago personalizados?**

```typescript
// Ejemplo correcto
const newMethod = await fetch('/api/payment-methods', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    label: "QR Personalizado",
    code: "qr_custom_001",
    type: "qr",
    isActive: true,
    metadata: { provider: "custom" }
  })
});
```

**Verificar:**
- [ ] El frontend puede crear métodos de pago
- [ ] Soporta tipos: `cash`, `transfer`, `qr`, `card`, `gateway`, `other`
- [ ] Guarda metadata personalizada

---

### 2. Resumen Financiero en Ventas

#### ✅ GET /api/sales/:id

**¿Tu frontend usa el campo `financial`?**

```typescript
// Ejemplo correcto
const sale = await fetch(`/api/sales/${saleId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await sale.json();

// Debe incluir:
data.financial = {
  totalAmount: "45000",
  paidAmount: "22500",
  balanceAmount: "22500",
  isPaid: false,
  paymentCompletedAt: null
}
```

**Verificar:**
- [ ] El frontend accede a `sale.financial.totalAmount`
- [ ] Muestra `sale.financial.paidAmount`
- [ ] Muestra `sale.financial.balanceAmount`
- [ ] Usa `sale.financial.isPaid` para indicar si está pagada
- [ ] **NO recalcula** estos valores en el frontend
- [ ] **Confía en los valores del backend**

---

### 3. Endpoints de Pagos

#### ✅ GET /api/sales/:id/payments

**¿Tu frontend muestra la lista de pagos con información completa?**

```typescript
// Ejemplo correcto
const response = await fetch(`/api/sales/${saleId}/payments`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// Debe incluir:
data = {
  payments: [
    {
      id: "uuid",
      amount: "22500",
      status: "confirmed",
      method: "transfer", // Backward compatibility
      payment_method_id: "uuid", // Nuevo campo
      payment_methods: { // Relación cargada
        id: "uuid",
        label: "Transferencia",
        code: "transfer",
        type: "transfer",
        is_active: true
      },
      reference: "Nro transferencia 12345",
      external_reference: null,
      gateway_metadata: null,
      created_at: "2024-12-23T..."
    }
  ],
  totalPaid: "22500", // Solo confirmed
  financial: {
    totalAmount: "45000",
    paidAmount: "22500",
    balanceAmount: "22500",
    isPaid: false
  }
}
```

**Verificar:**
- [ ] El frontend muestra la lista de pagos
- [ ] Incluye información de `payment_methods` (relación)
- [ ] Muestra `totalPaid` (solo confirmed)
- [ ] Muestra resumen financiero completo
- [ ] Filtra correctamente por estado (pending, confirmed, failed)

---

#### ✅ POST /api/sales/:id/payments

**¿Tu frontend crea pagos con `paymentMethodId`?**

```typescript
// ✅ Forma nueva (recomendada)
const payment = await fetch(`/api/sales/${saleId}/payments`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 22500,
    status: "confirmed",
    paymentMethodId: "uuid-del-metodo", // ✅ Usa paymentMethodId
    reference: "Pago con método configurable"
  })
});

// ✅ Backward compatibility (sigue funcionando)
const paymentOld = await fetch(`/api/sales/${saleId}/payments`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 22500,
    method: "transfer", // ✅ Sigue funcionando
    status: "confirmed",
    reference: "Pago con method string"
  })
});

// ✅ Para pasarelas (Mercado Pago, etc.)
const paymentGateway = await fetch(`/api/sales/${saleId}/payments`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 45000,
    status: "pending", // Inicialmente pending
    paymentMethodId: "uuid-metodo-mercadopago",
    reference: "Pago con Mercado Pago",
    externalReference: "MP-123456789", // ✅ Para pasarelas
    gatewayMetadata: { // ✅ Metadata de la pasarela
      provider: "mercadopago",
      payment_id: "123456789",
      status: "pending",
      init_point: "https://..."
    }
  })
});
```

**Verificar:**
- [ ] El frontend puede crear pagos con `paymentMethodId`
- [ ] Soporta backward compatibility con `method` string
- [ ] Guarda `externalReference` para pasarelas
- [ ] Guarda `gatewayMetadata` (JSON) para pasarelas
- [ ] Valida que la venta esté en estado `confirmed` o `paid`
- [ ] Rechaza pagos en ventas `draft` o `cancelled`

---

#### ✅ DELETE /api/payments/:id

**¿Tu frontend solo permite eliminar pagos `pending`?**

```typescript
// ✅ Solo funciona para pending
const deletePayment = async (paymentId: string) => {
  try {
    const response = await fetch(`/api/payments/${paymentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      // Pago eliminado (solo si era pending)
      return await response.json();
    } else {
      // Error: pago confirmed no puede eliminarse
      const error = await response.json();
      throw new Error(error.error);
    }
  } catch (error) {
    // Mostrar error al usuario
    console.error("No se puede eliminar:", error.message);
  }
};
```

**Verificar:**
- [ ] El frontend solo muestra botón "Eliminar" para pagos `pending`
- [ ] Oculta o deshabilita "Eliminar" para pagos `confirmed`
- [ ] Muestra error claro si intenta eliminar `confirmed`
- [ ] Actualiza el resumen financiero después de eliminar

---

### 4. Estados de Pago

**¿Tu frontend maneja correctamente los estados?**

```typescript
// Estados válidos:
type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

// Reglas:
// - pending: Puede eliminarse, NO cuenta en paid_amount
// - confirmed: NO puede eliminarse, SÍ cuenta en paid_amount
// - failed: NO puede eliminarse, NO cuenta en paid_amount
// - refunded: NO puede eliminarse, NO cuenta en paid_amount
```

**Verificar:**
- [ ] El frontend muestra estados: `pending`, `confirmed`, `failed`, `refunded`
- [ ] Solo cuenta `confirmed` en el total pagado
- [ ] Muestra indicadores visuales por estado (colores, badges)
- [ ] Permite cambiar estado de `pending` a `confirmed` o `failed`

---

### 5. Cálculo Financiero

**⚠️ IMPORTANTE: El frontend NO debe recalcular valores financieros**

```typescript
// ❌ INCORRECTO - NO hacer esto
const paidAmount = payments
  .filter(p => p.status === 'confirmed')
  .reduce((sum, p) => sum + parseFloat(p.amount), 0);
const balanceAmount = totalAmount - paidAmount;

// ✅ CORRECTO - Usar valores del backend
const { financial } = await fetch(`/api/sales/${saleId}`).then(r => r.json());
const paidAmount = financial.paidAmount; // Del backend
const balanceAmount = financial.balanceAmount; // Del backend
const isPaid = financial.isPaid; // Del backend
```

**Verificar:**
- [ ] El frontend **NO recalcula** `paid_amount` o `balance_amount`
- [ ] El frontend **confía en los valores del backend**
- [ ] Usa `sale.financial.paidAmount` directamente
- [ ] Usa `sale.financial.balanceAmount` directamente
- [ ] Usa `sale.financial.isPaid` para determinar si está pagada

---

### 6. Estados de Venta

**¿Tu frontend respeta las reglas de estados de venta?**

```typescript
// Estados válidos:
type SaleStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';

// Reglas:
// - draft: NO admite pagos, es editable
// - confirmed: SÍ admite pagos, NO es editable
// - paid: NO admite más pagos, NO es editable, NO es cancelable
// - cancelled: NO admite pagos, NO es editable
```

**Verificar:**
- [ ] El frontend oculta botón "Pagar" en ventas `draft`
- [ ] El frontend muestra botón "Pagar" solo en `confirmed`
- [ ] El frontend oculta botón "Pagar" en ventas `paid`
- [ ] El frontend permite editar solo ventas `draft`
- [ ] El frontend permite cancelar solo `draft` o `confirmed`
- [ ] El frontend muestra estado `paid` cuando `balanceAmount <= 0`

---

## 🔧 Ejemplo de Integración Completa

### Componente React/TypeScript de Ejemplo

```typescript
import { useState, useEffect } from 'react';

interface PaymentMethod {
  id: string;
  label: string;
  code: string;
  type: 'cash' | 'transfer' | 'qr' | 'card' | 'gateway' | 'other';
  is_active: boolean;
  metadata?: any;
}

interface SaleFinancial {
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  isPaid: boolean;
  paymentCompletedAt: string | null;
}

interface Payment {
  id: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  method?: string; // Backward compatibility
  payment_method_id?: string;
  payment_methods?: PaymentMethod;
  reference?: string;
  external_reference?: string;
  gateway_metadata?: any;
  created_at: string;
}

export function SalePayments({ saleId }: { saleId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financial, setFinancial] = useState<SaleFinancial | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar métodos de pago
  useEffect(() => {
    fetch('/api/payment-methods?isActive=true', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(data => setPaymentMethods(data))
      .catch(console.error);
  }, []);

  // Cargar pagos y resumen financiero
  useEffect(() => {
    fetch(`/api/sales/${saleId}/payments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(data => {
        setPayments(data.payments || []);
        setFinancial(data.financial);
        setLoading(false);
      })
      .catch(console.error);
  }, [saleId]);

  const createPayment = async (amount: number, paymentMethodId: string) => {
    const response = await fetch(`/api/sales/${saleId}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        status: 'confirmed',
        paymentMethodId,
        reference: 'Pago registrado desde frontend'
      })
    });

    if (response.ok) {
      // Recargar pagos
      const data = await response.json();
      setPayments(prev => [data, ...prev]);
      // Actualizar resumen financiero desde el backend
      const saleResponse = await fetch(`/api/sales/${saleId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const saleData = await saleResponse.json();
      setFinancial(saleData.financial);
    }
  };

  const deletePayment = async (paymentId: string) => {
    const response = await fetch(`/api/payments/${paymentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.ok) {
      // Recargar pagos
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      // Actualizar resumen financiero desde el backend
      const saleResponse = await fetch(`/api/sales/${saleId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const saleData = await saleResponse.json();
      setFinancial(saleData.financial);
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <h2>Pagos de la Venta</h2>
      
      {/* Resumen Financiero - Del backend */}
      {financial && (
        <div>
          <p>Total: ${financial.totalAmount}</p>
          <p>Pagado: ${financial.paidAmount}</p>
          <p>Saldo: ${financial.balanceAmount}</p>
          <p>Estado: {financial.isPaid ? 'Pagada' : 'Pendiente'}</p>
        </div>
      )}

      {/* Lista de Pagos */}
      <ul>
        {payments.map(payment => (
          <li key={payment.id}>
            <div>
              <strong>${payment.amount}</strong>
              <span> - {payment.payment_methods?.label || payment.method}</span>
              <span> - {payment.status}</span>
              {payment.status === 'pending' && (
                <button onClick={() => deletePayment(payment.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Crear Pago */}
      <select id="paymentMethod">
        {paymentMethods.map(method => (
          <option key={method.id} value={method.id}>
            {method.label}
          </option>
        ))}
      </select>
      <input type="number" id="amount" placeholder="Monto" />
      <button onClick={() => {
        const methodId = (document.getElementById('paymentMethod') as HTMLSelectElement).value;
        const amount = parseFloat((document.getElementById('amount') as HTMLInputElement).value);
        createPayment(amount, methodId);
      }}>
        Registrar Pago
      </button>
    </div>
  );
}

function getToken(): string {
  return localStorage.getItem('access_token') || '';
}
```

---

## 🐛 Problemas Comunes

### ❌ Error: "No se pueden registrar pagos en ventas draft"

**Causa:** Intentando crear un pago en una venta en estado `draft`.

**Solución:** Confirmar la venta primero:
```typescript
await fetch(`/api/sales/${saleId}/confirm`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### ❌ Error: "No se puede eliminar pago confirmed"

**Causa:** Intentando eliminar un pago que no está en estado `pending`.

**Solución:** Solo permitir eliminar pagos `pending`:
```typescript
if (payment.status === 'pending') {
  // Mostrar botón eliminar
} else {
  // Ocultar o deshabilitar botón eliminar
}
```

### ❌ Valores financieros incorrectos

**Causa:** Recalculando valores en el frontend.

**Solución:** Usar valores del backend:
```typescript
// ❌ NO hacer esto
const paidAmount = payments.reduce(...);

// ✅ Hacer esto
const { financial } = await fetch(`/api/sales/${saleId}`).then(r => r.json());
const paidAmount = financial.paidAmount;
```

---

## 📞 Soporte

Si encuentras problemas o tienes preguntas:

1. Ejecuta el script de verificación: `.\verificar-integracion-frontend.ps1`
2. Revisa la documentación completa: `API_SALES_DOCUMENTATION.md`
3. Verifica los logs del backend en la terminal
4. Contacta al equipo backend

---

**Última actualización:** Diciembre 2024

