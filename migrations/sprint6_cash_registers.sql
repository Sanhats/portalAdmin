-- SPRINT 6: Caja, Ingresos y Cierre Diario
-- Migración para crear tablas del sistema de caja diaria
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla cash_registers (Caja)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP, -- Nullable, se establece al cerrar
  opening_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Monto inicial
  closing_amount NUMERIC(15, 2), -- Monto declarado al cerrar
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para cash_registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant_id ON cash_registers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_seller_id ON cash_registers(seller_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at);

-- Constraint: Solo una caja abierta por vendedor y tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_registers_open_unique 
ON cash_registers(tenant_id, seller_id) 
WHERE status = 'open';

-- Comentarios
COMMENT ON TABLE cash_registers IS 'Cajas diarias por vendedor (SPRINT 6)';
COMMENT ON COLUMN cash_registers.opening_amount IS 'Monto inicial de la caja';
COMMENT ON COLUMN cash_registers.closing_amount IS 'Monto declarado al cerrar (para comparar con ingresos reales)';
COMMENT ON COLUMN cash_registers.status IS 'Estado: open | closed (cerrada es inmutable)';

-- ============================================
-- 2. Modificar tabla payments_sprint5 (agregar campos de caja)
-- ============================================
ALTER TABLE payments_sprint5
  ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES cash_registers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers(id) ON DELETE RESTRICT;

-- Índices para payments_sprint5 (nuevos campos)
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_cash_register_id ON payments_sprint5(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_seller_id ON payments_sprint5(seller_id);

-- Comentarios
COMMENT ON COLUMN payments_sprint5.cash_register_id IS 'Caja asociada al pago (SPRINT 6)';
COMMENT ON COLUMN payments_sprint5.seller_id IS 'Vendedor que registró el pago (SPRINT 6)';

-- ============================================
-- 3. Crear tabla cash_closures (Cierres de Caja)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  total_cash NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Total en efectivo
  total_transfer NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Total en transferencias
  total_card NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Total en tarjetas
  total_other NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Total en otros métodos
  total_income NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Total de ingresos (suma de todos)
  difference NUMERIC(15, 2) NOT NULL DEFAULT 0, -- closing_amount - total_income
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para cash_closures
CREATE INDEX IF NOT EXISTS idx_cash_closures_tenant_id ON cash_closures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_cash_register_id ON cash_closures(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_created_at ON cash_closures(created_at);

-- Comentarios
COMMENT ON TABLE cash_closures IS 'Cierres de caja inmutables (SPRINT 6)';
COMMENT ON COLUMN cash_closures.total_income IS 'Total de ingresos calculado desde payments_sprint5';
COMMENT ON COLUMN cash_closures.difference IS 'Diferencia: closing_amount - total_income (descuadre)';
COMMENT ON TABLE cash_closures IS 'Cierres de caja inmutables - NO EDITAR NI ELIMINAR (SPRINT 6)';

-- ============================================
-- 4. Función para calcular totales de caja desde payments
-- ============================================
CREATE OR REPLACE FUNCTION calculate_cash_totals(p_cash_register_id UUID)
RETURNS TABLE (
  total_cash NUMERIC,
  total_transfer NUMERIC,
  total_card NUMERIC,
  total_other NUMERIC,
  total_income NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN method = 'cash' THEN amount::numeric ELSE 0 END), 0) AS total_cash,
    COALESCE(SUM(CASE WHEN method = 'transfer' THEN amount::numeric ELSE 0 END), 0) AS total_transfer,
    COALESCE(SUM(CASE WHEN method = 'card' THEN amount::numeric ELSE 0 END), 0) AS total_card,
    COALESCE(SUM(CASE WHEN method = 'other' THEN amount::numeric ELSE 0 END), 0) AS total_other,
    COALESCE(SUM(amount::numeric), 0) AS total_income
  FROM payments_sprint5
  WHERE cash_register_id = p_cash_register_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION calculate_cash_totals IS 'Calcula totales de caja desde payments_sprint5 (SPRINT 6)';

-- ============================================
-- 5. Función para validar que no haya caja abierta
-- ============================================
CREATE OR REPLACE FUNCTION has_open_cash_register(
  p_tenant_id UUID,
  p_seller_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cash_registers
  WHERE tenant_id = p_tenant_id
    AND seller_id = p_seller_id
    AND status = 'open';
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION has_open_cash_register IS 'Verifica si un vendedor tiene caja abierta (SPRINT 6)';

-- ============================================
-- FIN DE MIGRACIÓN SPRINT 6
-- ============================================
