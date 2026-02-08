-- SPRINT 5: Cuentas Corrientes, Pagos y Saldos
-- Migración para crear tablas del sistema financiero base
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla accounts (Cuentas Corrientes)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'customer', -- Solo 'customer' en este sprint
  entity_id UUID NOT NULL, -- FK a customers (o futuras entidades)
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Solo informativo (cache)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_entity ON accounts(entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_customer 
ON accounts(tenant_id, entity_type, entity_id) 
WHERE entity_type = 'customer';

-- Comentarios
COMMENT ON TABLE accounts IS 'Cuentas corrientes de clientes (SPRINT 5)';
COMMENT ON COLUMN accounts.entity_type IS 'Tipo de entidad: solo customer en este sprint';
COMMENT ON COLUMN accounts.entity_id IS 'ID de la entidad (customer_id)';
COMMENT ON COLUMN accounts.balance IS 'Balance cacheado (solo informativo, se calcula desde movimientos)';

-- ============================================
-- 2. Crear tabla account_movements (Movimientos de Cuenta)
-- ============================================
CREATE TABLE IF NOT EXISTS account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sale', 'payment', 'adjustment', 'sale_cancelation')),
  reference_id UUID, -- FK a sales, payments, etc.
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para account_movements
CREATE INDEX IF NOT EXISTS idx_account_movements_tenant_id ON account_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_movements_account_id ON account_movements(account_id);
CREATE INDEX IF NOT EXISTS idx_account_movements_type ON account_movements(type);
CREATE INDEX IF NOT EXISTS idx_account_movements_reference ON account_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_account_movements_created_at ON account_movements(created_at);

-- Comentarios
COMMENT ON TABLE account_movements IS 'Movimientos financieros de cuentas corrientes (SPRINT 5)';
COMMENT ON COLUMN account_movements.type IS 'debit = aumenta deuda, credit = reduce deuda';
COMMENT ON COLUMN account_movements.reference_type IS 'Tipo de referencia: sale, payment, adjustment, sale_cancelation';
COMMENT ON COLUMN account_movements.reference_id IS 'ID de la referencia (sale_id, payment_id, etc.)';

-- ============================================
-- 3. Crear tabla payments_sprint5 (Pagos)
-- ============================================
-- Nota: Se usa payments_sprint5 para evitar conflicto con tabla payments existente
CREATE TABLE IF NOT EXISTS payments_sprint5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL, -- Opcional
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'transfer', 'card', 'other')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para payments_sprint5
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_tenant_id ON payments_sprint5(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_customer_id ON payments_sprint5(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_sale_id ON payments_sprint5(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_created_at ON payments_sprint5(created_at);

-- Comentarios
COMMENT ON TABLE payments_sprint5 IS 'Pagos de clientes (SPRINT 5)';
COMMENT ON COLUMN payments_sprint5.sale_id IS 'Venta asociada (opcional, permite pagos parciales)';
COMMENT ON COLUMN payments_sprint5.method IS 'Método de pago: cash, transfer, card, other';

-- ============================================
-- 4. Trigger para actualizar updated_at en accounts
-- ============================================
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_accounts_updated_at ON accounts;
CREATE TRIGGER trigger_update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_accounts_updated_at();

-- ============================================
-- 5. Función para recalcular balance de cuenta
-- ============================================
-- Esta función calcula el balance desde los movimientos
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC(15, 2);
BEGIN
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN type = 'debit' THEN amount
        WHEN type = 'credit' THEN -amount
        ELSE 0
      END
    ),
    0
  ) INTO v_balance
  FROM account_movements
  WHERE account_id = p_account_id;
  
  -- Actualizar balance cacheado
  UPDATE accounts
  SET balance = v_balance,
      updated_at = NOW()
  WHERE id = p_account_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION recalculate_account_balance IS 'Recalcula el balance de una cuenta desde sus movimientos (SPRINT 5)';

-- ============================================
-- 6. Trigger para actualizar balance automáticamente
-- ============================================
-- Actualiza el balance cacheado cuando se inserta un movimiento
CREATE OR REPLACE FUNCTION update_account_balance_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_account_balance(NEW.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_account_balance_on_movement ON account_movements;
CREATE TRIGGER trigger_update_account_balance_on_movement
  AFTER INSERT ON account_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance_on_movement();

-- ============================================
-- 7. Función helper para obtener o crear cuenta
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_account(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Intentar obtener cuenta existente
  SELECT id INTO v_account_id
  FROM accounts
  WHERE tenant_id = p_tenant_id
    AND entity_type = p_entity_type
    AND entity_id = p_entity_id
  LIMIT 1;
  
  -- Si no existe, crear nueva cuenta
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (tenant_id, entity_type, entity_id, balance)
    VALUES (p_tenant_id, p_entity_type, p_entity_id, 0)
    RETURNING id INTO v_account_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION get_or_create_account IS 'Obtiene o crea una cuenta corriente (SPRINT 5)';

-- ============================================
-- 8. Constraint: No permitir editar/eliminar movimientos
-- ============================================
-- Nota: PostgreSQL no permite constraints para prevenir UPDATE/DELETE directamente
-- Esto se maneja a nivel de aplicación (backend)
-- Pero podemos agregar un comentario en la tabla
COMMENT ON TABLE account_movements IS 'Movimientos financieros inmutables - NO EDITAR NI ELIMINAR (SPRINT 5)';

-- ============================================
-- FIN DE MIGRACIÓN SPRINT 5
-- ============================================
