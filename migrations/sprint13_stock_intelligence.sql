-- SPRINT 13: Gestión Inteligente de Stock - Alertas y Sugerencias de Reposición
-- Migración para crear tablas de alertas y configuración de stock por sucursal
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- 1. Crear tabla product_stock_branches (Stock por producto y sucursal)
-- ============================================
CREATE TABLE IF NOT EXISTS product_stock_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_stock INTEGER DEFAULT 0,
  ideal_stock INTEGER DEFAULT 0,
  reorder_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(branch_id, product_id)
);

-- Índices para product_stock_branches
CREATE INDEX IF NOT EXISTS idx_product_stock_branches_tenant_id ON product_stock_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_branches_branch_id ON product_stock_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_branches_product_id ON product_stock_branches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_branches_reorder_enabled ON product_stock_branches(reorder_enabled);

-- Comentarios
COMMENT ON TABLE product_stock_branches IS 'Configuración de stock por producto y sucursal (SPRINT 13)';
COMMENT ON COLUMN product_stock_branches.min_stock IS 'Stock mínimo para alerta (nullable)';
COMMENT ON COLUMN product_stock_branches.ideal_stock IS 'Stock ideal para reposición (nullable)';
COMMENT ON COLUMN product_stock_branches.reorder_enabled IS 'Si está habilitada la reposición automática';

-- ============================================
-- 2. Crear tabla stock_alerts (Alertas de stock)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL,
  min_stock INTEGER NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Índices para stock_alerts
CREATE INDEX IF NOT EXISTS idx_stock_alerts_tenant_id ON stock_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_branch_id ON stock_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_alert_type ON stock_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_tenant_branch_status ON stock_alerts(tenant_id, branch_id, status);

-- Constraint único: Solo una alerta activa por producto y sucursal
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_unique_active 
ON stock_alerts(branch_id, product_id) 
WHERE status = 'ACTIVE';

-- Comentarios
COMMENT ON TABLE stock_alerts IS 'Alertas automáticas de stock (SPRINT 13)';
COMMENT ON COLUMN stock_alerts.alert_type IS 'Tipo de alerta: LOW_STOCK | OUT_OF_STOCK';
COMMENT ON COLUMN stock_alerts.status IS 'Estado: ACTIVE | RESOLVED (no se elimina, solo se resuelve)';
COMMENT ON COLUMN stock_alerts.resolved_at IS 'Fecha de resolución (nullable hasta que se resuelva)';

-- ============================================
-- 3. Función para calcular stock actual por sucursal
-- ============================================
CREATE OR REPLACE FUNCTION get_stock_by_branch(
  p_product_id UUID,
  p_branch_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock
  FROM stock_movements
  WHERE product_id = p_product_id
    AND branch_id = p_branch_id;
  
  RETURN v_stock;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION get_stock_by_branch IS 'Calcula stock actual de un producto en una sucursal (SPRINT 13)';

-- ============================================
-- 4. Función para detectar y crear alertas automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION detect_stock_alert(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_product_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_current_stock INTEGER;
  v_min_stock INTEGER;
  v_alert_type TEXT;
  v_alert_id UUID;
  v_existing_alert_id UUID;
BEGIN
  -- Obtener stock actual por sucursal
  v_current_stock := get_stock_by_branch(p_product_id, p_branch_id);
  
  -- Obtener min_stock de la configuración
  SELECT min_stock INTO v_min_stock
  FROM product_stock_branches
  WHERE branch_id = p_branch_id
    AND product_id = p_product_id;
  
  -- Si no hay configuración, no crear alerta
  IF v_min_stock IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Determinar tipo de alerta
  IF v_current_stock <= 0 THEN
    v_alert_type := 'OUT_OF_STOCK';
  ELSIF v_current_stock < v_min_stock THEN
    v_alert_type := 'LOW_STOCK';
  ELSE
    -- Si stock >= min_stock, resolver alerta activa si existe
    SELECT id INTO v_existing_alert_id
    FROM stock_alerts
    WHERE branch_id = p_branch_id
      AND product_id = p_product_id
      AND status = 'ACTIVE'
    LIMIT 1;
    
    IF v_existing_alert_id IS NOT NULL THEN
      UPDATE stock_alerts
      SET status = 'RESOLVED',
          resolved_at = NOW()
      WHERE id = v_existing_alert_id;
    END IF;
    
    RETURN NULL;
  END IF;
  
  -- Verificar si ya existe una alerta activa del mismo tipo
  SELECT id INTO v_existing_alert_id
  FROM stock_alerts
  WHERE branch_id = p_branch_id
    AND product_id = p_product_id
    AND status = 'ACTIVE'
    AND alert_type = v_alert_type
  LIMIT 1;
  
  -- Si ya existe, no crear duplicado
  IF v_existing_alert_id IS NOT NULL THEN
    RETURN v_existing_alert_id;
  END IF;
  
  -- Resolver alertas anteriores si existen
  UPDATE stock_alerts
  SET status = 'RESOLVED',
      resolved_at = NOW()
  WHERE branch_id = p_branch_id
    AND product_id = p_product_id
    AND status = 'ACTIVE';
  
  -- Crear nueva alerta
  INSERT INTO stock_alerts (
    tenant_id,
    branch_id,
    product_id,
    current_stock,
    min_stock,
    alert_type,
    status
  )
  VALUES (
    p_tenant_id,
    p_branch_id,
    p_product_id,
    v_current_stock,
    v_min_stock,
    v_alert_type,
    'ACTIVE'
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION detect_stock_alert IS 'Detecta y crea alertas de stock automáticamente (SPRINT 13)';

-- ============================================
-- 5. Trigger para detectar alertas después de movimientos de stock
-- ============================================
CREATE OR REPLACE FUNCTION trigger_detect_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si branch_id está presente (SPRINT 12+)
  IF NEW.branch_id IS NOT NULL THEN
    PERFORM detect_stock_alert(
      NEW.tenant_id,
      NEW.branch_id,
      NEW.product_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para detectar alertas
DROP TRIGGER IF EXISTS trigger_detect_stock_alert ON stock_movements;
CREATE TRIGGER trigger_detect_stock_alert
  AFTER INSERT OR UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_detect_stock_alert();

-- Comentario
COMMENT ON FUNCTION trigger_detect_stock_alert IS 'Trigger para detectar alertas automáticamente después de movimientos (SPRINT 13)';

-- ============================================
-- FIN DE MIGRACIÓN SPRINT 13
-- ============================================
