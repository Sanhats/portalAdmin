# Script para detener el servidor en el puerto 3000

Write-Host "Buscando proceso en el puerto 3000..." -ForegroundColor Yellow

# Obtener el proceso que está usando el puerto 3000
$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($connection) {
    $pid = $connection.OwningProcess
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Proceso encontrado: $($process.ProcessName) (PID: $pid)" -ForegroundColor Green
        Write-Host "Deteniendo proceso..." -ForegroundColor Yellow
        
        Stop-Process -Id $pid -Force
        Write-Host "✅ Proceso detenido correctamente" -ForegroundColor Green
    } else {
        Write-Host "No se pudo obtener información del proceso" -ForegroundColor Red
    }
} else {
    Write-Host "No hay ningún proceso usando el puerto 3000" -ForegroundColor Yellow
}

