-- SPRINT ERP: Migración para Proveedores → Compras → Costos → Margen
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit
-- IMPORTANTE: El orden de creación es crítico debido a las dependencias de foreign keys

-- ============================================
-- 1. Agregar campo cost a products
-- ============================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cost NUMERIC(15, 2);

COMMENT ON COLUMN products.cost IS 'Costo base del producto (nullable inicialmente, se actualiza con compras)';

-- ============================================
-- 2. Crear tabla suppliers (Proveedores)
-- PRIMERO: No depende de tablas nuevas
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at);

COMMENT ON TABLE suppliers IS 'Proveedores del sistema (multi-tenant)';
COMMENT ON COLUMN suppliers.deleted_at IS 'Soft delete';

-- ============================================
-- 3. Crear tabla purchases (Compras)
-- SEGUNDO: Depende de suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'received', 'cancelled')),
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  confirmed_at TIMESTAMP,
  received_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

COMMENT ON TABLE purchases IS 'Compras a proveedores (multi-tenant)';
COMMENT ON COLUMN purchases.status IS 'draft | confirmed | received | cancelled';
COMMENT ON COLUMN purchases.total_cost IS 'Costo total de la compra (subtotal por ahora, sin impuestos)';
COMMENT ON COLUMN purchases.received_at IS 'Fecha de recepción (cuando se actualiza stock y costos)';

-- ============================================
-- 4. Crear tabla purchase_items (Items de Compra)
-- TERCERO: Depende de purchases, products, variants
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost > 0),
  total_cost NUMERIC(15, 2) NOT NULL CHECK (total_cost > 0),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_variant_id ON purchase_items(variant_id);

COMMENT ON TABLE purchase_items IS 'Items de compra (productos comprados)';
COMMENT ON COLUMN purchase_items.unit_cost IS 'Costo unitario de compra';
COMMENT ON COLUMN purchase_items.total_cost IS 'quantity * unit_cost';

-- ============================================
-- 5. Extender stock_movements con referencias
-- CUARTO: Ahora purchases existe, podemos agregar la FK
-- ============================================
ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS purchase_id UUID,
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;

-- Agregar FK a purchases después de crear la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'stock_movements_purchase_id_fkey'
  ) THEN
    ALTER TABLE stock_movements 
    ADD CONSTRAINT stock_movements_purchase_id_fkey 
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_purchase_id ON stock_movements(purchase_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale_id ON stock_movements(sale_id);

COMMENT ON COLUMN stock_movements.purchase_id IS 'FK a purchases (si el movimiento viene de una compra)';
COMMENT ON COLUMN stock_movements.sale_id IS 'FK a sales (si el movimiento viene de una venta)';

-- ============================================
-- 6. Extender cash_movements con purchase_id
-- QUINTO: Ahora purchases existe, podemos agregar la FK
-- ============================================
ALTER TABLE cash_movements 
ADD COLUMN IF NOT EXISTS purchase_id UUID;

-- Agregar FK a purchases después de crear la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cash_movements_purchase_id_fkey'
  ) THEN
    ALTER TABLE cash_movements 
    ADD CONSTRAINT cash_movements_purchase_id_fkey 
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_movements_purchase_id ON cash_movements(purchase_id);

COMMENT ON COLUMN cash_movements.purchase_id IS 'FK opcional a purchases (para compras como egresos)';

-- ============================================
-- 7. Índices adicionales para optimización
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_received_at ON purchases(received_at) WHERE received_at IS NOT NULL;

-- ============================================
-- 9. Comentarios finales
-- ============================================
COMMENT ON SCHEMA public IS 'SPRINT ERP: Sistema de Proveedores → Compras → Costos → Margen completado';
