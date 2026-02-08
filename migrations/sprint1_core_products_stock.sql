-- SPRINT 1: Núcleo Comercial - Productos, Listas de Precios, Stock
-- Migración para crear/actualizar tablas del núcleo comercial
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Actualizar tabla products con nuevos campos
-- ============================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unit' CHECK (unit IN ('unit', 'kg', 'g'));

-- Índices para barcode (único por tenant)
CREATE INDEX IF NOT EXISTS idx_products_barcode_tenant ON products(store_id, barcode) WHERE barcode IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN products.barcode IS 'Código de barras del producto (opcional, único por tenant)';
COMMENT ON COLUMN products.is_weighted IS 'Indica si el producto se vende a granel (por peso)';
COMMENT ON COLUMN products.unit IS 'Unidad de medida: unit, kg, g';

-- ============================================
-- 2. Crear tabla product_stock
-- ============================================
CREATE TABLE IF NOT EXISTS product_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  stock_current INTEGER NOT NULL DEFAULT 0,
  stock_min INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_stock_product_id ON product_stock(product_id);

-- Comentarios
COMMENT ON TABLE product_stock IS 'Stock actual y mínimo por producto';
COMMENT ON COLUMN product_stock.stock_current IS 'Stock actual del producto (derivado de movimientos)';
COMMENT ON COLUMN product_stock.stock_min IS 'Stock mínimo de alerta';

-- ============================================
-- 3. Actualizar tabla stock_movements según Sprint 1
-- ============================================
-- Primero, verificar si la tabla existe y tiene la estructura antigua
DO $$
BEGIN
  -- Si la tabla existe pero no tiene tenant_id, agregarlo
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'stock_movements'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_movements' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE stock_movements
      ADD COLUMN tenant_id UUID REFERENCES stores(id) ON DELETE CASCADE,
      ADD COLUMN type TEXT CHECK (type IN ('purchase', 'sale', 'adjustment', 'cancelation')),
      ADD COLUMN quantity INTEGER,
      ADD COLUMN reference_id UUID;
    
    -- Migrar datos existentes si hay
    UPDATE stock_movements sm
    SET 
      tenant_id = (SELECT store_id FROM products WHERE id = sm.product_id),
      type = CASE 
        WHEN sm.reason ILIKE '%venta%' OR sm.reason ILIKE '%sale%' THEN 'sale'
        WHEN sm.reason ILIKE '%compra%' OR sm.reason ILIKE '%purchase%' THEN 'purchase'
        WHEN sm.reason ILIKE '%ajuste%' OR sm.reason ILIKE '%adjustment%' THEN 'adjustment'
        ELSE 'adjustment'
      END,
      quantity = sm.difference,
      reference_id = COALESCE(sm.purchase_id, sm.sale_id)
    WHERE tenant_id IS NULL;
    
    -- Hacer tenant_id NOT NULL después de migrar
    ALTER TABLE stock_movements
      ALTER COLUMN tenant_id SET NOT NULL,
      ALTER COLUMN type SET NOT NULL,
      ALTER COLUMN quantity SET NOT NULL;
    
    -- Eliminar columnas antiguas si existen
    ALTER TABLE stock_movements
      DROP COLUMN IF EXISTS previous_stock,
      DROP COLUMN IF EXISTS new_stock,
      DROP COLUMN IF EXISTS difference,
      DROP COLUMN IF EXISTS reason,
      DROP COLUMN IF EXISTS purchase_id,
      DROP COLUMN IF EXISTS sale_id;
  END IF;
END $$;

-- Si la tabla no existe, crearla desde cero
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'cancelation')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- Comentarios
COMMENT ON TABLE stock_movements IS 'Movimientos de stock auditables';
COMMENT ON COLUMN stock_movements.type IS 'Tipo de movimiento: purchase, sale, adjustment, cancelation';
COMMENT ON COLUMN stock_movements.quantity IS 'Cantidad del movimiento (+ entrada, - salida)';
COMMENT ON COLUMN stock_movements.reference_id IS 'Referencia opcional a purchase, sale, etc.';

-- ============================================
-- 4. Crear tabla product_prices (4 listas de precios)
-- ============================================
CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_list_id INTEGER NOT NULL CHECK (price_list_id IN (1, 2, 3, 4)),
  price NUMERIC(15, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, price_list_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_price_list_id ON product_prices(price_list_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product_list ON product_prices(product_id, price_list_id);

-- Comentarios
COMMENT ON TABLE product_prices IS 'Precios por lista de precios (4 listas fijas)';
COMMENT ON COLUMN product_prices.price_list_id IS 'ID de lista de precios: 1, 2, 3, 4';
COMMENT ON COLUMN product_prices.price IS 'Precio en la lista especificada';

-- ============================================
-- 5. Función para actualizar stock_current desde movimientos
-- ============================================
CREATE OR REPLACE FUNCTION update_product_stock_current()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_stock (product_id, stock_current, updated_at)
  VALUES (
    NEW.product_id,
    COALESCE((
      SELECT SUM(quantity) 
      FROM stock_movements 
      WHERE product_id = NEW.product_id
    ), 0),
    NOW()
  )
  ON CONFLICT (product_id) 
  DO UPDATE SET
    stock_current = COALESCE((
      SELECT SUM(quantity) 
      FROM stock_movements 
      WHERE product_id = NEW.product_id
    ), 0),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock_current automáticamente
DROP TRIGGER IF EXISTS trigger_update_stock_current ON stock_movements;
CREATE TRIGGER trigger_update_stock_current
  AFTER INSERT OR UPDATE OR DELETE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_current();

-- ============================================
-- 6. Migrar stock existente de products a product_stock
-- ============================================
INSERT INTO product_stock (product_id, stock_current, stock_min)
SELECT 
  id,
  COALESCE(stock, 0),
  0
FROM products
WHERE id NOT IN (SELECT product_id FROM product_stock WHERE product_id IS NOT NULL)
ON CONFLICT (product_id) DO NOTHING;

-- ============================================
-- 7. Crear movimientos iniciales desde stock existente
-- ============================================
-- Solo si no hay movimientos previos para estos productos
INSERT INTO stock_movements (tenant_id, product_id, type, quantity)
SELECT 
  p.store_id,
  p.id,
  'adjustment',
  COALESCE(p.stock, 0)
FROM products p
WHERE COALESCE(p.stock, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm 
    WHERE sm.product_id = p.id
  )
  AND p.store_id IS NOT NULL
ON CONFLICT DO NOTHING;
