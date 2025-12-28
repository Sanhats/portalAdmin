# Script: Asignar external_id a un POS existente
# Intenta asignar un external_id al POS usando la API de Mercado Pago

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$PosId = "123439423",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalId = "POS_Toludev"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Asignar External ID a POS" -ForegroundColor Cyan
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

Write-Host "POS ID: $PosId" -ForegroundColor Gray
Write-Host "External ID deseado: $ExternalId" -ForegroundColor Gray
Write-Host ""

# Intentar actualizar el POS
Write-Host "Intentando actualizar POS..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    # Intentar actualizar el POS con external_id
    $updateBody = @{
        external_id = $ExternalId
    } | ConvertTo-Json
    
    Write-Host "Body: $updateBody" -ForegroundColor Gray
    
    # El endpoint puede ser PUT /pos/{pos_id} o similar
    $response = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos/$PosId" `
        -Method PUT `
        -Headers $headers `
        -Body $updateBody `
        -ErrorAction Stop
    
    Write-Host "SUCCESS: POS actualizado" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "ERROR: $statusCode" -ForegroundColor Red
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        $errorJson = $errorBody | ConvertFrom-Json
        
        Write-Host "Error details:" -ForegroundColor Yellow
        $errorJson | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
        
        Write-Host ""
        Write-Host "NOTA: La API de Mercado Pago puede no permitir actualizar external_id" -ForegroundColor Yellow
        Write-Host "      El external_id debe asignarse al crear el POS" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternativa: Usar el ID numerico directamente en el endpoint" -ForegroundColor Cyan
        Write-Host "  El codigo ya esta usando el ID numerico ($PosId)" -ForegroundColor Gray
        Write-Host "  Si sigue dando 404, puede ser un problema de permisos o formato del endpoint" -ForegroundColor Gray
        
    } catch {
        Write-Host "No se pudo leer detalles del error" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}


