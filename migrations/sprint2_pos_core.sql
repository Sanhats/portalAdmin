-- SPRINT 2: POS Core - Ventas, Caja y Vendedores
-- Migración para crear/actualizar tablas del núcleo POS
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla sellers (Vendedores)
-- ============================================
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sellers_tenant_id ON sellers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sellers_active ON sellers(active);

-- Comentarios
COMMENT ON TABLE sellers IS 'Vendedores del sistema POS';
COMMENT ON COLUMN sellers.active IS 'Indica si el vendedor está activo (puede vender)';

-- ============================================
-- 2. Actualizar tabla sales según Sprint 2
-- ============================================
-- Agregar campos requeridos del Sprint 2
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS total NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_received NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS change_given NUMERIC(15, 2);

-- Actualizar status para usar confirmed/canceled (mantener backward compatibility)
-- Si no existe constraint, crearlo
DO $$
BEGIN
  -- Actualizar status default si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'status' AND column_default = 'confirmed'
  ) THEN
    ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'confirmed';
  END IF;
  
  -- Actualizar total desde total_amount si está vacío
  UPDATE sales 
  SET total = COALESCE(total_amount, 0)
  WHERE total IS NULL OR total = 0;
  
  -- Actualizar discount_total desde discounts si está vacío
  UPDATE sales 
  SET discount_total = COALESCE(discounts, 0)
  WHERE discount_total IS NULL OR discount_total = 0;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- Comentarios
COMMENT ON COLUMN sales.seller_id IS 'Vendedor que realizó la venta';
COMMENT ON COLUMN sales.total IS 'Total de la venta';
COMMENT ON COLUMN sales.discount_total IS 'Total de descuentos aplicados';
COMMENT ON COLUMN sales.cash_received IS 'Efectivo recibido (solo para pagos en efectivo)';
COMMENT ON COLUMN sales.change_given IS 'Vuelto dado (solo para pagos en efectivo)';

-- ============================================
-- 3. Actualizar tabla sale_items según Sprint 2
-- ============================================
-- Cambiar quantity a NUMERIC para soportar pesables
DO $$
BEGIN
  -- Si quantity es INTEGER, cambiarlo a NUMERIC
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_items' 
    AND column_name = 'quantity' 
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE sale_items 
    ALTER COLUMN quantity TYPE NUMERIC(15, 3);
  END IF;
  
  -- Agregar columna total si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_items' AND column_name = 'total'
  ) THEN
    ALTER TABLE sale_items 
    ADD COLUMN total NUMERIC(15, 2) NOT NULL DEFAULT 0;
    
    -- Calcular total desde subtotal si existe
    UPDATE sale_items 
    SET total = COALESCE(subtotal, 0)
    WHERE total = 0;
  END IF;
  
  -- Cambiar stock_impacted a NUMERIC si es INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_items' 
    AND column_name = 'stock_impacted' 
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE sale_items 
    ALTER COLUMN stock_impacted TYPE NUMERIC(15, 3);
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN sale_items.quantity IS 'Cantidad vendida (NUMERIC para soportar pesables)';
COMMENT ON COLUMN sale_items.total IS 'Total del item (quantity * unit_price)';

-- ============================================
-- 4. Crear tabla cash_sessions (Sesiones de Caja)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  opening_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(15, 2),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_id ON cash_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_seller_id ON cash_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_seller_open ON cash_sessions(seller_id) 
  WHERE status = 'open';

-- Comentarios
COMMENT ON TABLE cash_sessions IS 'Sesiones de caja por vendedor';
COMMENT ON COLUMN cash_sessions.opening_amount IS 'Monto inicial de la caja';
COMMENT ON COLUMN cash_sessions.closing_amount IS 'Monto final de la caja (calculado al cerrar)';
COMMENT ON COLUMN cash_sessions.status IS 'Estado de la sesión: open o closed';

-- ============================================
-- 5. Crear/Actualizar tabla cash_movements (Movimientos de Caja)
-- ============================================
-- Nota: Esta tabla puede existir con estructura antigua (cash_box_id del Sprint B1)
-- Agregamos las columnas necesarias para el Sprint 2 sin romper la estructura existente

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agregar columnas del Sprint 2 si no existen
DO $$
BEGIN
  -- Agregar cash_session_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'cash_session_id'
  ) THEN
    ALTER TABLE cash_movements 
    ADD COLUMN cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE CASCADE;
  END IF;
  
  -- Agregar type si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE cash_movements 
    ADD COLUMN type TEXT;
  END IF;
  
  -- Agregar amount si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'amount'
  ) THEN
    ALTER TABLE cash_movements 
    ADD COLUMN amount NUMERIC(15, 2);
  END IF;
  
  -- Agregar reference_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE cash_movements 
    ADD COLUMN reference_id UUID;
  END IF;
  
  -- Agregar constraint de type si no existe y la columna type existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'cash_movements' 
    AND constraint_name = 'cash_movements_type_check'
  ) THEN
    ALTER TABLE cash_movements 
    ADD CONSTRAINT cash_movements_type_check 
    CHECK (type IN ('sale', 'refund', 'manual', 'income', 'expense'));
    -- Incluimos 'income' y 'expense' para compatibilidad con estructura antigua
  END IF;
END $$;

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON cash_movements(cash_session_id) 
  WHERE cash_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(type) 
  WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_reference_id ON cash_movements(reference_id) 
  WHERE reference_id IS NOT NULL;

-- Comentarios (solo si las columnas existen)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'type'
  ) THEN
    COMMENT ON COLUMN cash_movements.type IS 'Tipo de movimiento: sale, refund, manual (Sprint 2) o income, expense (Sprint B1)';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'amount'
  ) THEN
    COMMENT ON COLUMN cash_movements.amount IS 'Monto del movimiento';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'reference_id'
  ) THEN
    COMMENT ON COLUMN cash_movements.reference_id IS 'Referencia a sales.id si el movimiento es por venta/anulación (Sprint 2)';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'cash_session_id'
  ) THEN
    COMMENT ON COLUMN cash_movements.cash_session_id IS 'FK a cash_sessions (Sprint 2)';
  END IF;
END $$;

-- ============================================
-- 6. Función para validar que un vendedor solo tenga una caja abierta
-- ============================================
CREATE OR REPLACE FUNCTION validate_single_open_cash_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    -- Verificar que no haya otra caja abierta para el mismo vendedor
    IF EXISTS (
      SELECT 1 FROM cash_sessions 
      WHERE seller_id = NEW.seller_id 
      AND status = 'open' 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'El vendedor ya tiene una caja abierta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar caja única abierta
DROP TRIGGER IF EXISTS trigger_validate_single_open_cash_session ON cash_sessions;
CREATE TRIGGER trigger_validate_single_open_cash_session
  BEFORE INSERT OR UPDATE ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_open_cash_session();

-- ============================================
-- 7. Función para calcular closing_amount al cerrar caja
-- ============================================
CREATE OR REPLACE FUNCTION calculate_cash_session_closing()
RETURNS TRIGGER AS $$
DECLARE
  total_movements NUMERIC(15, 2);
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    -- Calcular total de movimientos
    SELECT COALESCE(SUM(amount), 0) INTO total_movements
    FROM cash_session_movements
    WHERE cash_session_id = NEW.id;
    
    -- Calcular closing_amount = opening_amount + movimientos
    NEW.closing_amount := NEW.opening_amount + total_movements;
    NEW.closed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular closing_amount
DROP TRIGGER IF EXISTS trigger_calculate_cash_session_closing ON cash_sessions;
CREATE TRIGGER trigger_calculate_cash_session_closing
  BEFORE UPDATE ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_cash_session_closing();

-- ============================================
-- 8. Constraint: No se puede vender sin caja abierta
-- ============================================
-- Esta validación se hará en el backend, pero podemos agregar un check constraint
-- Nota: Esto se validará en la aplicación, no en la BD directamente

-- ============================================
-- 9. Migración de datos existentes (si aplica)
-- ============================================
-- Si hay ventas existentes sin seller_id, asignar un vendedor por defecto
DO $$
DECLARE
  default_seller_id UUID;
  first_tenant_id UUID;
BEGIN
  -- Obtener el primer tenant_id de stores
  SELECT id INTO first_tenant_id
  FROM stores
  LIMIT 1;
  
  -- Si hay stores, crear vendedor por defecto si no existe
  IF first_tenant_id IS NOT NULL THEN
    -- Verificar si ya existe un vendedor por defecto
    SELECT id INTO default_seller_id
    FROM sellers
    WHERE name = 'Vendedor por Defecto'
    AND tenant_id = first_tenant_id
    LIMIT 1;
    
    -- Si no existe, crearlo
    IF default_seller_id IS NULL THEN
      INSERT INTO sellers (tenant_id, name, active)
      VALUES (first_tenant_id, 'Vendedor por Defecto', TRUE)
      RETURNING id INTO default_seller_id;
    END IF;
    
    -- Asignar vendedor por defecto a ventas sin seller_id del mismo tenant
    IF default_seller_id IS NOT NULL THEN
      UPDATE sales
      SET seller_id = default_seller_id
      WHERE seller_id IS NULL
      AND tenant_id = first_tenant_id;
    END IF;
  END IF;
END $$;
