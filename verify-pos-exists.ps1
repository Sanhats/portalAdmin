# Script: Verificar si el POS existe en Mercado Pago
# Lista todos los POS y busca el que tiene external_id = POS_Toludev

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalPosId = "POS_Toludev"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificar POS en Mercado Pago" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener access token desde .env.local si no se proporciona
if ([string]::IsNullOrEmpty($AccessToken)) {
    $envFile = ".env.local"
    if (Test-Path $envFile) {
        Write-Host "Leyendo Access Token desde .env.local..." -ForegroundColor Gray
        $envLines = Get-Content $envFile
        foreach ($line in $envLines) {
            if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
                $AccessToken = $matches[1].Trim()
                if ($AccessToken.StartsWith('"') -and $AccessToken.EndsWith('"')) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                if ($AccessToken.StartsWith("'") -and $AccessToken.EndsWith("'")) {
                    $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                }
                break
            }
        }
    }
}

if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "ERROR: Access Token no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Buscando POS con external_id: $ExternalPosId" -ForegroundColor Yellow
Write-Host ""

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    # Listar todos los POS
    Write-Host "Listando todos los POS..." -ForegroundColor Yellow
    $posList = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method GET -Headers $headers -ErrorAction Stop
    
    # La respuesta puede ser un array o un objeto con un array
    $posArray = @()
    if ($posList -is [Array]) {
        $posArray = $posList
    } elseif ($posList.results) {
        $posArray = $posList.results
    } elseif ($posList.data) {
        $posArray = $posList.data
    } else {
        # Intentar como objeto único
        $posArray = @($posList)
    }
    
    Write-Host "Respuesta completa de la API:" -ForegroundColor Cyan
    $posList | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "POS encontrados: $($posArray.Count)" -ForegroundColor Green
    Write-Host ""
    
    if ($posArray.Count -eq 0) {
        Write-Host "No se encontraron POS" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Necesitas crear un POS primero:" -ForegroundColor Cyan
        Write-Host "1. Ve a Mercado Pago Dashboard" -ForegroundColor Gray
        Write-Host "2. Puntos de venta -> Crear nuevo" -ForegroundColor Gray
        Write-Host "3. Asigna external_id: $ExternalPosId" -ForegroundColor Gray
        exit 0
    }
    
    Write-Host "Lista de POS:" -ForegroundColor Yellow
    foreach ($pos in $posArray) {
        Write-Host "  ID: $($pos.id)" -ForegroundColor White
        Write-Host "    Nombre: $($pos.name)" -ForegroundColor Gray
        Write-Host "    External ID: $($pos.external_id)" -ForegroundColor Gray
        $tipo = if ($pos.fixed_amount) { "Monto fijo" } else { "Monto abierto" }
        Write-Host "    Tipo: $tipo" -ForegroundColor Gray
        Write-Host ""
    }
    
    # Buscar el POS con el external_id especificado
    $targetPos = $posArray | Where-Object { $_.external_id -eq $ExternalPosId } | Select-Object -First 1
    
    if ($targetPos) {
        Write-Host "POS encontrado:" -ForegroundColor Green
        Write-Host "  ID: $($targetPos.id)" -ForegroundColor White
        Write-Host "  Nombre: $($targetPos.name)" -ForegroundColor White
        Write-Host "  External ID: $($targetPos.external_id)" -ForegroundColor White
        Write-Host ""
        Write-Host "El POS existe y esta configurado correctamente" -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: No se encontro POS con external_id '$ExternalPosId'" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Opciones:" -ForegroundColor Cyan
        Write-Host "1. Crear el POS manualmente en Mercado Pago Dashboard" -ForegroundColor Gray
        Write-Host "2. Usar uno de los POS existentes y actualizar la configuracion" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Para usar un POS existente, ejecuta este SQL:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "UPDATE payment_gateways" -ForegroundColor DarkGray
        Write-Host "SET config = jsonb_set(" -ForegroundColor DarkGray
        Write-Host "  config," -ForegroundColor DarkGray
        Write-Host "  '{mercadopago_external_pos_id}'," -ForegroundColor DarkGray
        Write-Host "  'EXTERNAL_ID_DEL_POS_EXISTENTE'" -ForegroundColor DarkGray
        Write-Host ")" -ForegroundColor DarkGray
        Write-Host "WHERE provider = 'mercadopago'" -ForegroundColor DarkGray
        Write-Host "  AND tenant_id = '5fc90125-23b9-4200-bd86-c6edba203f16';" -ForegroundColor DarkGray
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Detalles: $errorBody" -ForegroundColor Yellow
        } catch {
            Write-Host "No se pudo leer detalles del error" -ForegroundColor Gray
        }
    }
}

