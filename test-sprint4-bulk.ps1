# Script de prueba para SPRINT 4 - POST /api/products/bulk (Importacion masiva CSV)

Write-Host "=== Prueba SPRINT 4 - Importacion Masiva CSV ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor este corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   OK Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   ERROR Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Creando archivo CSV de prueba..." -ForegroundColor Yellow

# Crear CSV de prueba con algunos productos validos y algunos con errores
$csvContent = @"
sku,nameInternal,price,stock,description,isActive,isVisible
BULK-001,Producto Bulk 1,15000,50,Descripcion del producto 1,true,false
BULK-002,Producto Bulk 2,20000,30,Descripcion del producto 2,true,true
BULK-003,Producto Bulk 3,12000,25,Descripcion del producto 3,true,false
BULK-004,Producto Bulk 4,18000,40,,true,false
BULK-005,Producto Bulk 5,25000,15,Descripcion del producto 5,true,true
BULK-ERROR-1,Producto sin precio,,10,Error: falta precio,true,false
BULK-ERROR-2,,20000,20,Error: falta nameInternal,true,false
BULK-ERROR-3,Producto SKU invalido,15000,30,Error: SKU con minusculas,true,false
"@

$csvPath = "test-bulk-import.csv"
$csvContent | Out-File -FilePath $csvPath -Encoding UTF8 -NoNewline

Write-Host "   OK Archivo CSV creado: $csvPath" -ForegroundColor Green
Write-Host "   Contiene 8 filas (5 validas, 3 con errores)" -ForegroundColor Gray

Write-Host ""
Write-Host "3. Probando importacion masiva..." -ForegroundColor Yellow

try {
    # Leer archivo
    $fileBytes = [System.IO.File]::ReadAllBytes($csvPath)
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"

    # Construir multipart/form-data
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$csvPath`"",
        "Content-Type: text/csv",
        "",
        [System.Text.Encoding]::UTF8.GetString($fileBytes),
        "--$boundary--"
    ) -join $LF

    $headers = @{
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }

    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/products/bulk" `
        -Method POST `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyLines)) `
        -Headers $headers

    Write-Host "   OK Importacion completada!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Resultados:" -ForegroundColor Cyan
    Write-Host "   Creados: $($response.created)" -ForegroundColor Green
    Write-Host "   Fallidos: $($response.failed)" -ForegroundColor $(if ($response.failed -gt 0) { "Yellow" } else { "Green" })
    
    if ($response.errors -and $response.errors.Count -gt 0) {
        Write-Host ""
        Write-Host "   Errores encontrados:" -ForegroundColor Yellow
        $response.errors | ForEach-Object {
            Write-Host "   Fila $($_.row): $($_.reason)" -ForegroundColor Red
            Write-Host "      SKU: $($_.sku)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Sin errores!" -ForegroundColor Green
    }

} catch {
    Write-Host "   ERROR Error al importar" -ForegroundColor Red
    Write-Host "   Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "   Detalles:" -ForegroundColor Yellow
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($errorJson) {
                Write-Host ($errorJson | ConvertTo-Json -Depth 3) -ForegroundColor Red
            } else {
                Write-Host $_.ErrorDetails.Message -ForegroundColor Red
            }
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
    
    if ($_.Exception.Response.StatusCode.value__) {
        Write-Host "   Codigo HTTP: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
} finally {
    # Limpiar archivo temporal
    if (Test-Path $csvPath) {
        Remove-Item $csvPath -Force
        Write-Host ""
        Write-Host "   Archivo temporal eliminado" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "4. Probando validacion (archivo no CSV)..." -ForegroundColor Yellow

try {
    # Crear archivo de texto que no es CSV
    $txtContent = "Este no es un CSV"
    $txtPath = "test-not-csv.txt"
    $txtContent | Out-File -FilePath $txtPath -Encoding UTF8

    $fileBytes = [System.IO.File]::ReadAllBytes($txtPath)
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"

    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$txtPath`"",
        "Content-Type: text/plain",
        "",
        [System.Text.Encoding]::UTF8.GetString($fileBytes),
        "--$boundary--"
    ) -join $LF

    $headers = @{
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }

    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products/bulk" `
        -Method POST `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyLines)) `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "   ERROR Deberia haber fallado!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (archivo no es CSV)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} finally {
    if (Test-Path $txtPath) {
        Remove-Item $txtPath -Force
    }
}

Write-Host ""
Write-Host "5. Probando validacion (sin archivo)..." -ForegroundColor Yellow

try {
    # Crear FormData vacío
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $bodyLines = @(
        "--$boundary",
        "--$boundary--"
    ) -join $LF

    $headers = @{
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }

    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products/bulk" `
        -Method POST `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyLines)) `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "   ERROR Deberia haber fallado!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "   OK Correctamente rechazado (archivo faltante)" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OK Pruebas del SPRINT 4 completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen SPRINT 4:" -ForegroundColor Cyan
Write-Host "  - Importacion masiva desde CSV" -ForegroundColor Gray
Write-Host "  - Validacion fila por fila" -ForegroundColor Gray
Write-Host "  - Guardado de productos validos" -ForegroundColor Gray
Write-Host "  - Reporte detallado de errores" -ForegroundColor Gray
Write-Host "  - Importacion segura e idempotente" -ForegroundColor Gray

