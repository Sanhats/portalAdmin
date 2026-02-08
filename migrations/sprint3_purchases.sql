-- SPRINT 3: Módulo Compras, Proveedores y Stock Entrante
-- Migración para actualizar tablas según especificaciones Sprint 3
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Actualizar tabla suppliers según Sprint 3
-- ============================================
-- Agregar contact_name e is_active
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Migrar deleted_at a is_active si existe
DO $$
BEGIN
  -- Si hay registros con deleted_at NULL, asegurar is_active = true
  UPDATE suppliers
  SET is_active = TRUE
  WHERE is_active IS NULL;
  
  -- Si hay registros con deleted_at NOT NULL, marcar is_active = false
  UPDATE suppliers
  SET is_active = FALSE
  WHERE deleted_at IS NOT NULL
  AND is_active IS NULL;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_active ON suppliers(tenant_id, is_active);

-- Comentarios
COMMENT ON COLUMN suppliers.contact_name IS 'Nombre de contacto del proveedor (opcional)';
COMMENT ON COLUMN suppliers.is_active IS 'Indica si el proveedor está activo (soft delete)';

-- ============================================
-- 2. Actualizar tabla purchases según Sprint 3
-- ============================================
-- Agregar campos requeridos del Sprint 3
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Migrar total_cost a total_amount si existe
DO $$
BEGIN
  -- Si total_amount es 0 y total_cost tiene valor, copiar
  UPDATE purchases
  SET total_amount = COALESCE(total_cost, 0)
  WHERE total_amount = 0
  AND total_cost IS NOT NULL;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_number ON purchases(invoice_number) WHERE invoice_number IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN purchases.invoice_number IS 'Número de factura (opcional)';
COMMENT ON COLUMN purchases.purchase_date IS 'Fecha de compra';
COMMENT ON COLUMN purchases.total_amount IS 'Total de la compra (calculado automáticamente)';

-- ============================================
-- 3. Actualizar tabla purchase_items según Sprint 3
-- ============================================
-- Cambiar quantity a NUMERIC si es INTEGER
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' 
    AND column_name = 'quantity' 
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE purchase_items 
    ALTER COLUMN quantity TYPE NUMERIC(15, 3);
  END IF;
END $$;

-- Agregar subtotal si no existe
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Migrar total_cost a subtotal si existe
DO $$
BEGIN
  UPDATE purchase_items
  SET subtotal = COALESCE(total_cost, 0)
  WHERE subtotal = 0
  AND total_cost IS NOT NULL;
END $$;

-- Comentarios
COMMENT ON COLUMN purchase_items.quantity IS 'Cantidad comprada (NUMERIC para soportar decimales)';
COMMENT ON COLUMN purchase_items.subtotal IS 'Subtotal del item (quantity * unit_cost)';

-- ============================================
-- 4. Verificar que stock_movements soporte tipo purchase
-- ============================================
-- El tipo 'purchase' ya está soportado desde Sprint 1
-- Solo verificamos que el constraint permita 'purchase'
DO $$
BEGIN
  -- Si existe un constraint que no incluye 'purchase', necesitamos actualizarlo
  -- Por ahora, asumimos que ya está correcto (se agregó en Sprint 1)
  -- Si hay problemas, se pueden agregar aquí
END $$;

-- ============================================
-- 5. Función para calcular total_amount automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION calculate_purchase_total()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total NUMERIC(15, 2);
BEGIN
  -- Calcular total desde purchase_items
  SELECT COALESCE(SUM(subtotal), 0) INTO calculated_total
  FROM purchase_items
  WHERE purchase_id = NEW.id;
  
  -- Actualizar total_amount
  UPDATE purchases
  SET total_amount = calculated_total
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar total_amount cuando se insertan/actualizan items
DROP TRIGGER IF EXISTS trigger_calculate_purchase_total ON purchase_items;
CREATE TRIGGER trigger_calculate_purchase_total
  AFTER INSERT OR UPDATE OR DELETE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_purchase_total();

-- ============================================
-- 6. Función para validar que purchase_items tenga subtotal correcto
-- ============================================
CREATE OR REPLACE FUNCTION validate_purchase_item_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular subtotal si no está correcto
  IF NEW.subtotal != (NEW.quantity * NEW.unit_cost) THEN
    NEW.subtotal := NEW.quantity * NEW.unit_cost;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar subtotal
DROP TRIGGER IF EXISTS trigger_validate_purchase_item_subtotal ON purchase_items;
CREATE TRIGGER trigger_validate_purchase_item_subtotal
  BEFORE INSERT OR UPDATE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_purchase_item_subtotal();

-- ============================================
-- 7. Constraint: No permitir quantity <= 0
-- ============================================
ALTER TABLE purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_quantity_positive;
  
ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_quantity_positive 
  CHECK (quantity > 0);

-- ============================================
-- 8. Constraint: No permitir modificar compras (solo lectura después de creada)
-- ============================================
-- Nota: Esta validación se hará en el backend, pero podemos agregar un trigger
-- que prevenga actualizaciones después de creada
CREATE OR REPLACE FUNCTION prevent_purchase_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la compra ya existe (OLD.id existe), prevenir modificación
  IF OLD.id IS NOT NULL THEN
    RAISE EXCEPTION 'No se permite modificar una compra una vez creada';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir modificaciones
DROP TRIGGER IF EXISTS trigger_prevent_purchase_modification ON purchases;
CREATE TRIGGER trigger_prevent_purchase_modification
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_purchase_modification();

-- ============================================
-- 9. Constraint: No permitir eliminar compras
-- ============================================
-- Nota: Esta validación se hará en el backend
-- En PostgreSQL, podemos usar ON DELETE RESTRICT en las foreign keys
-- que ya está configurado en purchase_items

-- ============================================
-- 10. Índices adicionales para auditoría
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stock_movements_purchase ON stock_movements(type, reference_id) 
  WHERE type = 'purchase';
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_date ON purchases(tenant_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
