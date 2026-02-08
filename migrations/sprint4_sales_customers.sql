-- SPRINT 4: Ventas, Clientes y Stock Saliente
-- Migración para crear/actualizar tablas del módulo de ventas con clientes
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla customers (Clientes)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT, -- DNI / CUIT (opcional, único por tenant)
  email TEXT,
  phone TEXT,
  address TEXT,
  active BOOLEAN DEFAULT TRUE, -- Soft delete
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);
CREATE INDEX IF NOT EXISTS idx_customers_document ON customers(tenant_id, document) WHERE document IS NOT NULL;

-- Constraint: documento único por tenant (solo si existe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_unique_document 
ON customers(tenant_id, document) 
WHERE document IS NOT NULL;

-- Comentarios
COMMENT ON TABLE customers IS 'Clientes del sistema';
COMMENT ON COLUMN customers.document IS 'DNI / CUIT (opcional, único por tenant)';
COMMENT ON COLUMN customers.active IS 'Indica si el cliente está activo (soft delete)';

-- ============================================
-- 2. Actualizar tabla sales según Sprint 4
-- ============================================
-- Agregar campos requeridos del Sprint 4
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2) DEFAULT 0;

-- Actualizar status default a 'draft' si no existe
DO $$
BEGIN
  -- Si la columna status no tiene default, establecerlo
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_status_default'
  ) THEN
    ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'draft';
  END IF;
  
  -- Actualizar ventas existentes sin status a 'draft' si están en estado inválido
  UPDATE sales
  SET status = 'draft'
  WHERE status IS NULL OR status NOT IN ('draft', 'confirmed', 'cancelled');
END $$;

-- Asegurar que subtotal existe y tiene valor por defecto
ALTER TABLE sales
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN subtotal SET NOT NULL;

-- Asegurar que total existe y tiene valor por defecto
ALTER TABLE sales
  ALTER COLUMN total SET DEFAULT 0,
  ALTER COLUMN total SET NOT NULL;

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_status ON sales(tenant_id, status);

-- Comentarios
COMMENT ON COLUMN sales.customer_id IS 'Cliente asociado (nullable → venta mostrador)';
COMMENT ON COLUMN sales.date IS 'Fecha de la venta';
COMMENT ON COLUMN sales.subtotal IS 'Suma de ítems (calculado en backend)';
COMMENT ON COLUMN sales.discount_percentage IS 'Porcentaje de descuento aplicado';
COMMENT ON COLUMN sales.discount_amount IS 'Monto de descuento (calculado en backend)';
COMMENT ON COLUMN sales.total IS 'Total final: subtotal - discount_amount';
COMMENT ON COLUMN sales.status IS 'Estado: draft | confirmed | cancelled';

-- ============================================
-- 3. Actualizar tabla sale_items según Sprint 4
-- ============================================
-- Agregar campo total_price (SPRINT 4)
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(15, 2);

-- Migrar datos: si total_price es NULL, calcular desde total o quantity * unit_price
DO $$
BEGIN
  -- Si total_price es NULL y total tiene valor, copiar
  UPDATE sale_items
  SET total_price = COALESCE(total, 0)
  WHERE total_price IS NULL AND total IS NOT NULL;
  
  -- Si total_price es NULL y no hay total, calcular desde quantity * unit_price
  UPDATE sale_items
  SET total_price = COALESCE(quantity::numeric * unit_price::numeric, 0)
  WHERE total_price IS NULL;
END $$;

-- Asegurar que total_price no sea NULL
ALTER TABLE sale_items
  ALTER COLUMN total_price SET NOT NULL,
  ALTER COLUMN total_price SET DEFAULT 0;

-- Comentarios
COMMENT ON COLUMN sale_items.total_price IS 'Total del item: quantity * unit_price (SPRINT 4)';

-- ============================================
-- 4. Verificar/actualizar stock_movements para tipo 'sale'
-- ============================================
-- Asegurar que el tipo 'sale' existe en stock_movements
-- (Ya debería existir desde Sprint 1, pero verificamos)
DO $$
BEGIN
  -- Verificar si existe constraint CHECK para type
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%stock_movements_type%'
  ) THEN
    -- Si existe, no hacer nada (ya está configurado)
    NULL;
  ELSE
    -- Si no existe, agregar constraint básico
    ALTER TABLE stock_movements
    ADD CONSTRAINT check_stock_movements_type 
    CHECK (type IN ('purchase', 'sale', 'adjustment', 'cancelation'));
  END IF;
END $$;

-- Índices adicionales para stock_movements relacionados con ventas
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale_reference 
ON stock_movements(reference_id) 
WHERE type = 'sale';

-- ============================================
-- 5. Triggers para actualizar updated_at
-- ============================================
-- Trigger para customers
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customers_updated_at ON customers;
CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- ============================================
-- 6. Datos iniciales (opcional)
-- ============================================
-- No se crean datos iniciales para customers
-- Cada tenant creará sus propios clientes

-- ============================================
-- FIN DE MIGRACIÓN SPRINT 4
-- ============================================
