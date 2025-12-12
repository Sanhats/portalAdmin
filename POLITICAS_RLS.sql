-- ============================================
-- Políticas RLS para Ecommerce Backend
-- ============================================
-- 
-- Ejecutar este script en Supabase SQL Editor
-- Después de habilitar RLS en cada tabla
--
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EN LAS TABLAS
-- ============================================
-- Nota: Esto se hace desde el Table Editor en Supabase Dashboard
-- O ejecuta estos comandos:

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. POLÍTICAS DE LECTURA PÚBLICA (SELECT)
-- ============================================
-- Permiten que cualquiera pueda leer (para el catálogo público)

-- Categories
CREATE POLICY "Public Read Access"
ON categories FOR SELECT
USING (true);

-- Products
CREATE POLICY "Public Read Access"
ON products FOR SELECT
USING (true);

-- Product Images
CREATE POLICY "Public Read Access"
ON product_images FOR SELECT
USING (true);

-- Variants
CREATE POLICY "Public Read Access"
ON variants FOR SELECT
USING (true);

-- ============================================
-- 3. POLÍTICAS DE ESCRITURA SOLO PARA AUTHENTICATED (INSERT)
-- ============================================

-- Categories
CREATE POLICY "Admin Write Access"
ON categories FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Products
CREATE POLICY "Admin Write Access"
ON products FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Product Images
CREATE POLICY "Admin Write Access"
ON product_images FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Variants
CREATE POLICY "Admin Write Access"
ON variants FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 4. POLÍTICAS DE ACTUALIZACIÓN SOLO PARA AUTHENTICATED (UPDATE)
-- ============================================

-- Categories
CREATE POLICY "Admin Update Access"
ON categories FOR UPDATE
USING (auth.role() = 'authenticated');

-- Products
CREATE POLICY "Admin Update Access"
ON products FOR UPDATE
USING (auth.role() = 'authenticated');

-- Product Images
CREATE POLICY "Admin Update Access"
ON product_images FOR UPDATE
USING (auth.role() = 'authenticated');

-- Variants
CREATE POLICY "Admin Update Access"
ON variants FOR UPDATE
USING (auth.role() = 'authenticated');

-- ============================================
-- 5. POLÍTICAS DE ELIMINACIÓN SOLO PARA AUTHENTICATED (DELETE)
-- ============================================

-- Categories
CREATE POLICY "Admin Delete Access"
ON categories FOR DELETE
USING (auth.role() = 'authenticated');

-- Products
CREATE POLICY "Admin Delete Access"
ON products FOR DELETE
USING (auth.role() = 'authenticated');

-- Product Images
CREATE POLICY "Admin Delete Access"
ON product_images FOR DELETE
USING (auth.role() = 'authenticated');

-- Variants
CREATE POLICY "Admin Delete Access"
ON variants FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Para verificar que las políticas están creadas:

-- SELECT * FROM pg_policies WHERE tablename IN ('categories', 'products', 'product_images', 'variants');

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. El backend usa service_role_key que BYPASEA RLS
--    Esto es necesario para que el middleware funcione
--
-- 2. Las políticas RLS protegen contra acceso directo
--    desde el frontend sin autenticación
--
-- 3. El middleware de Next.js valida tokens ANTES
--    de que las requests lleguen a los endpoints
--
-- 4. Flujo de seguridad:
--    Frontend → Token Bearer → Middleware valida
--    → Endpoint usa service_role_key (bypasea RLS)
--
-- ============================================

