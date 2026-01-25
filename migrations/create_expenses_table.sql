-- SPRINT: Rentabilidad real & egresos mínimos
-- Migración para crear tabla expenses (egresos operativos)
-- Ejecutar este script en Supabase SQL Editor o mediante Drizzle Kit

-- ============================================
-- Crear tabla expenses (Egresos)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('alquiler', 'servicios', 'proveedores', 'otros')),
  amount NUMERIC(15, 2) NOT NULL,
  date TIMESTAMP NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);

-- Comentarios
COMMENT ON TABLE expenses IS 'Egresos operativos del sistema (multi-tenant)';
COMMENT ON COLUMN expenses.type IS 'Tipo de egreso: alquiler, servicios, proveedores, otros';
COMMENT ON COLUMN expenses.amount IS 'Monto del egreso';
COMMENT ON COLUMN expenses.date IS 'Fecha del egreso';
COMMENT ON COLUMN expenses.is_recurring IS 'Indica si el egreso es recurrente';
