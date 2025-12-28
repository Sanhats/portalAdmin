# Script: Encontrar Tenant ID
# Este script consulta la API para encontrar el tenant_id

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Buscar Tenant ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Consultando stores disponibles..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
}

try {
    # Intentar obtener stores desde la API (si existe endpoint)
    # Si no existe, mostrar instrucciones para SQL
    
    Write-Host "No hay endpoint de stores en la API, ejecuta este SQL en Supabase:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SELECT id as tenant_id, name, slug FROM stores WHERE deleted_at IS NULL;" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "O para ver el gateway de Mercado Pago y su tenant_id:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SELECT" -ForegroundColor DarkGray
    Write-Host "  pg.tenant_id," -ForegroundColor DarkGray
    Write-Host "  s.name as store_name," -ForegroundColor DarkGray
    Write-Host "  s.slug as store_slug," -ForegroundColor DarkGray
    Write-Host "  pg.config->>'mercadopago_user_id' as current_user_id" -ForegroundColor DarkGray
    Write-Host "FROM payment_gateways pg" -ForegroundColor DarkGray
    Write-Host "LEFT JOIN stores s ON s.id = pg.tenant_id" -ForegroundColor DarkGray
    Write-Host "WHERE pg.provider = 'mercadopago';" -ForegroundColor DarkGray
    Write-Host ""
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Alternativa: Ver en Supabase Dashboard" -ForegroundColor Cyan
Write-Host "1. Ve a Supabase Dashboard" -ForegroundColor Gray
Write-Host "2. Table Editor -> stores" -ForegroundColor Gray
Write-Host "3. Copia el 'id' de la fila que quieras usar" -ForegroundColor Gray
Write-Host ""

