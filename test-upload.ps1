# Script de prueba para el sistema de upload

Write-Host "=== Prueba del Sistema de Upload ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
Write-Host "1. Verificando que el servidor esté corriendo..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "✅ Servidor funcionando correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: El servidor no está corriendo o no responde" -ForegroundColor Red
    Write-Host "   Ejecuta: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "2. Probando GET /api/upload (listar archivos)..." -ForegroundColor Yellow
try {
    $files = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" -Method GET
    Write-Host "✅ Éxito! Archivos encontrados: $($files.count)" -ForegroundColor Green
    if ($files.files.Count -gt 0) {
        Write-Host "   Archivos:" -ForegroundColor Gray
        $files.files | ForEach-Object {
            Write-Host "   - $($_.name) ($([math]::Round($_.metadata.size/1KB, 2)) KB)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Para probar POST /api/upload necesitas:" -ForegroundColor Yellow
Write-Host "   - Una imagen de prueba (JPEG, PNG, WebP o GIF)" -ForegroundColor Gray
Write-Host "   - Usar curl.exe o hacerlo desde el frontend" -ForegroundColor Gray
Write-Host ""
Write-Host "   Ejemplo con curl.exe:" -ForegroundColor Cyan
Write-Host '   curl.exe -X POST http://localhost:3000/api/upload -F "file=@ruta\a\tu\imagen.jpg"' -ForegroundColor White
Write-Host ""

Write-Host "4. Flujo completo recomendado:" -ForegroundColor Yellow
Write-Host "   a) Subir imagen a /api/upload" -ForegroundColor Gray
Write-Host "   b) Obtener la URL de la respuesta" -ForegroundColor Gray
Write-Host "   c) Crear producto con esa URL" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Tip: Si tienes una imagen de prueba, puedes usar:" -ForegroundColor Yellow
Write-Host '   $response = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" -Method POST -InFile "ruta\imagen.jpg" -ContentType "multipart/form-data"' -ForegroundColor White
Write-Host "   (Nota: PowerShell tiene limitaciones con multipart/form-data, mejor usar curl.exe o frontend)" -ForegroundColor Gray

