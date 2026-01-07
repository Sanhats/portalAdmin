-- SPRINT B1: Migración para crear tablas de contabilidad operativa (cajas diarias)
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- Tabla: cash_boxes (Cajas Diarias)
CREATE TABLE IF NOT EXISTS cash_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla: cash_movements (Movimientos de Caja)
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_box_id UUID NOT NULL REFERENCES cash_boxes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  reference TEXT,
  -- Trazabilidad opcional
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_cash_boxes_tenant_id ON cash_boxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_boxes_date ON cash_boxes(date);
CREATE INDEX IF NOT EXISTS idx_cash_boxes_status ON cash_boxes(status);
CREATE INDEX IF NOT EXISTS idx_cash_boxes_tenant_date_status ON cash_boxes(tenant_id, date, status);

CREATE INDEX IF NOT EXISTS idx_cash_movements_cash_box_id ON cash_movements(cash_box_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant_id ON cash_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_payment_id ON cash_movements(payment_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_sale_id ON cash_movements(sale_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(type);
CREATE INDEX IF NOT EXISTS idx_cash_movements_payment_method ON cash_movements(payment_method);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON cash_movements(created_at);

-- Comentarios para documentación
COMMENT ON TABLE cash_boxes IS 'Cajas diarias para contabilidad operativa. Una caja por día por tenant.';
COMMENT ON TABLE cash_movements IS 'Movimientos de dinero (ingresos/egresos) asociados a una caja diaria.';

COMMENT ON COLUMN cash_boxes.date IS 'Fecha de la caja (solo fecha, sin hora específica)';
COMMENT ON COLUMN cash_boxes.opening_balance IS 'Saldo inicial al abrir la caja';
COMMENT ON COLUMN cash_boxes.closing_balance IS 'Saldo final calculado al cerrar la caja';
COMMENT ON COLUMN cash_boxes.status IS 'Estado: open (abierta) o closed (cerrada)';

COMMENT ON COLUMN cash_movements.cash_box_id IS 'FK obligatoria a cash_boxes. Todo movimiento pertenece a una caja.';
COMMENT ON COLUMN cash_movements.type IS 'Tipo: income (ingreso) o expense (egreso)';
COMMENT ON COLUMN cash_movements.payment_method IS 'Método: cash (efectivo) o transfer (transferencia)';
COMMENT ON COLUMN cash_movements.reference IS 'Texto descriptivo libre (ej: "Venta #1234", "Compra insumos")';
COMMENT ON COLUMN cash_movements.payment_id IS 'FK opcional a payments. NULL para movimientos manuales.';
COMMENT ON COLUMN cash_movements.sale_id IS 'FK opcional a sales. NULL para movimientos manuales.';
