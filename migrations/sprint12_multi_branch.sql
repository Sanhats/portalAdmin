-- SPRINT 12: Multi-Sucursal, Multi-Caja y Operación Concurrente
-- Migración para crear tabla branches y agregar branch_id a todas las tablas relacionadas
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla branches (Sucursales)
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para branches
CREATE INDEX IF NOT EXISTS idx_branches_tenant_id ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(active);
CREATE INDEX IF NOT EXISTS idx_branches_tenant_active ON branches(tenant_id, active);

-- Comentarios
COMMENT ON TABLE branches IS 'Sucursales por tenant (SPRINT 12)';
COMMENT ON COLUMN branches.active IS 'Sucursal activa (no se elimina, solo se desactiva)';

-- ============================================
-- 2. Agregar branch_id a cash_registers
-- ============================================
ALTER TABLE cash_registers
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en cash_registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_id ON cash_registers(branch_id);

-- Modificar constraint único: ahora por (tenant_id, seller_id, branch_id)
DROP INDEX IF EXISTS idx_cash_registers_open_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_registers_open_unique 
ON cash_registers(tenant_id, seller_id, branch_id) 
WHERE status = 'open';

-- Comentario
COMMENT ON COLUMN cash_registers.branch_id IS 'Sucursal asociada a la caja (SPRINT 12) - REQUERIDO';

-- ============================================
-- 3. Agregar branch_id a sales
-- ============================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en sales
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);

-- Comentario
COMMENT ON COLUMN sales.branch_id IS 'Sucursal donde se realizó la venta (SPRINT 12) - REQUERIDO';

-- ============================================
-- 4. Agregar branch_id a payments
-- ============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en payments
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);

-- Comentario
COMMENT ON COLUMN payments.branch_id IS 'Sucursal asociada al pago (SPRINT 12) - REQUERIDO';

-- ============================================
-- 5. Agregar branch_id a payments_sprint5
-- ============================================
ALTER TABLE payments_sprint5
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en payments_sprint5
CREATE INDEX IF NOT EXISTS idx_payments_sprint5_branch_id ON payments_sprint5(branch_id);

-- Comentario
COMMENT ON COLUMN payments_sprint5.branch_id IS 'Sucursal asociada al pago (SPRINT 12) - REQUERIDO';

-- ============================================
-- 6. Agregar branch_id a stock_movements
-- ============================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id ON stock_movements(branch_id);

-- Comentario
COMMENT ON COLUMN stock_movements.branch_id IS 'Sucursal donde ocurrió el movimiento de stock (SPRINT 12) - REQUERIDO';

-- ============================================
-- 7. Agregar branch_id a purchases
-- ============================================
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Índice para branch_id en purchases
CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON purchases(branch_id);

-- Comentario
COMMENT ON COLUMN purchases.branch_id IS 'Sucursal donde se realizó la compra (SPRINT 12) - REQUERIDO';

-- ============================================
-- 8. Función para validar que no haya caja abierta por sucursal
-- ============================================
CREATE OR REPLACE FUNCTION has_open_cash_register_by_branch(
  p_tenant_id UUID,
  p_seller_id UUID,
  p_branch_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cash_registers
  WHERE tenant_id = p_tenant_id
    AND seller_id = p_seller_id
    AND branch_id = p_branch_id
    AND status = 'open';
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION has_open_cash_register_by_branch IS 'Verifica si un vendedor tiene caja abierta en una sucursal específica (SPRINT 12)';

-- ============================================
-- 9. Función para obtener sucursal activa por defecto de un tenant
-- ============================================
CREATE OR REPLACE FUNCTION get_default_branch(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT id INTO v_branch_id
  FROM branches
  WHERE tenant_id = p_tenant_id
    AND active = true
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION get_default_branch IS 'Obtiene la primera sucursal activa de un tenant (SPRINT 12)';

-- ============================================
-- 10. Validación: Al menos una sucursal activa por tenant
-- ============================================
-- Esta validación se hará en el backend, pero podemos agregar un trigger como medida de seguridad
CREATE OR REPLACE FUNCTION validate_at_least_one_active_branch()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INTEGER;
BEGIN
  -- Si se está desactivando una sucursal, verificar que quede al menos una activa
  IF NEW.active = false AND OLD.active = true THEN
    SELECT COUNT(*) INTO v_active_count
    FROM branches
    WHERE tenant_id = NEW.tenant_id
      AND active = true
      AND id != NEW.id;
    
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'No se puede desactivar la última sucursal activa del tenant';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar al menos una sucursal activa
DROP TRIGGER IF EXISTS trigger_validate_at_least_one_active_branch ON branches;
CREATE TRIGGER trigger_validate_at_least_one_active_branch
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION validate_at_least_one_active_branch();

-- ============================================
-- FIN DE MIGRACIÓN SPRINT 12
-- ============================================
