# ═══════════════════════════════════════════════════════════════════════
# TEST: Verificar Corrección de Terminal ID en Campo 26
# ═══════════════════════════════════════════════════════════════════════
# 
# Este script verifica que el Terminal ID en el campo 26 sea FIJO
# y no contenga la referencia de pago variable
#
# ═══════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST: Verificación de Terminal ID FIJO en Campo 26" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ───────────────────────────────────────────────────────────────────────
# Configuración
# ───────────────────────────────────────────────────────────────────────

$baseUrl = "http://localhost:3000"
$apiUrl = "$baseUrl/api/sales"

# Obtener token de autenticación
Write-Host "[1/5] Obteniendo token de autenticación..." -ForegroundColor Yellow
$token = $env:SUPABASE_ANON_KEY
if (-not $token) {
    Write-Host "[ERROR] Variable SUPABASE_ANON_KEY no configurada" -ForegroundColor Red
    Write-Host "        Ejecuta: `$env:SUPABASE_ANON_KEY = 'tu_token_aqui'" -ForegroundColor Gray
    exit 1
}
Write-Host "[OK] Token obtenido" -ForegroundColor Green

# ───────────────────────────────────────────────────────────────────────
# Paso 1: Crear una venta de prueba
# ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/5] Creando venta de prueba..." -ForegroundColor Yellow

$salePayload = @{
    items = @(
        @{
            product_id = "12345678-1234-1234-1234-123456789012"
            quantity = 1
            unit_price = 150.00
            discount = 0
        }
    )
    payment_status = "pending"
} | ConvertTo-Json

try {
    $saleResponse = Invoke-RestMethod -Uri $apiUrl -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $salePayload -ErrorAction Stop
    
    $saleId = $saleResponse.id
    Write-Host "[OK] Venta creada: $saleId" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Error al crear venta: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ───────────────────────────────────────────────────────────────────────
# Paso 2: Generar QR Interoperable
# ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[3/5] Generando QR Interoperable..." -ForegroundColor Yellow

$qrPayload = @{
    amount = 150.00
    qr_type = "interoperable"
} | ConvertTo-Json

try {
    $qrResponse = Invoke-RestMethod -Uri "$apiUrl/$saleId/payments/qr" -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $qrPayload -ErrorAction Stop
    
    Write-Host "[OK] QR generado exitosamente" -ForegroundColor Green
    
    # Extraer payload EMV
    $emvPayload = $qrResponse.qr_payload
    Write-Host ""
    Write-Host "Payload EMV completo:" -ForegroundColor Cyan
    Write-Host $emvPayload -ForegroundColor White
}
catch {
    Write-Host "[ERROR] Error al generar QR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ───────────────────────────────────────────────────────────────────────
# Paso 3: Extraer y verificar Campo 26
# ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/5] Analizando Campo 26..." -ForegroundColor Yellow

# Buscar campo 26 en el payload
$campo26Index = $emvPayload.IndexOf("26")
if ($campo26Index -eq -1) {
    Write-Host "[ERROR] Campo 26 no encontrado en el payload" -ForegroundColor Red
    exit 1
}

# Extraer longitud del campo 26
$campo26LengthStr = $emvPayload.Substring($campo26Index + 2, 2)
$campo26Length = [int]$campo26LengthStr

# Extraer campo 26 completo
$campo26 = $emvPayload.Substring($campo26Index, 4 + $campo26Length)

Write-Host ""
Write-Host "Campo 26 extraído:" -ForegroundColor Cyan
Write-Host $campo26 -ForegroundColor White

# Extraer subcampos
$subcampos = $campo26.Substring(4) # Remover "26XX"

# Subcampo 00: País
$sub00Length = [int]$subcampos.Substring(2, 2)
$sub00Value = $subcampos.Substring(4, $sub00Length)

# Subcampo 01: CBU/CVU
$sub01Start = 4 + $sub00Length
$sub01Length = [int]$subcampos.Substring($sub01Start + 2, 2)
$sub01Value = $subcampos.Substring($sub01Start + 4, $sub01Length)

# Subcampo 02: Terminal ID
$sub02Start = $sub01Start + 4 + $sub01Length
$sub02Length = [int]$subcampos.Substring($sub02Start + 2, 2)
$sub02Value = $subcampos.Substring($sub02Start + 4, $sub02Length)

Write-Host ""
Write-Host "Subcampos del Campo 26:" -ForegroundColor Cyan
Write-Host "  00 (País):       $sub00Value" -ForegroundColor Gray
Write-Host "  01 (CBU/CVU):    $sub01Value" -ForegroundColor Gray
Write-Host "  02 (Terminal):   $sub02Value" -ForegroundColor Yellow

# ───────────────────────────────────────────────────────────────────────
# Paso 4: Verificar que Terminal ID sea FIJO
# ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[5/5] Verificando corrección..." -ForegroundColor Yellow

$testsPassed = 0
$testsFailed = 0

Write-Host ""
Write-Host "Pruebas de verificación:" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 1: Terminal ID debe ser "TERMINAL01"
if ($sub02Value -eq "TERMINAL01") {
    Write-Host "[OK] Test 1: Terminal ID es 'TERMINAL01' (FIJO)" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "[ERROR] Test 1: Terminal ID NO es 'TERMINAL01' (encontrado: '$sub02Value')" -ForegroundColor Red
    $testsFailed++
}

# Test 2: Terminal ID NO debe contener "SALE-"
if (-not $sub02Value.Contains("SALE-")) {
    Write-Host "[OK] Test 2: Terminal ID NO contiene 'SALE-' (correcto)" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "[ERROR] Test 2: Terminal ID contiene 'SALE-' (error, es variable)" -ForegroundColor Red
    $testsFailed++
}

# Test 3: Terminal ID debe tener longitud razonable (max 25 caracteres)
if ($sub02Value.Length -le 25) {
    Write-Host "[OK] Test 3: Terminal ID tiene longitud valida ($($sub02Value.Length) caracteres)" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "[ERROR] Test 3: Terminal ID excede longitud maxima ($($sub02Value.Length) > 25)" -ForegroundColor Red
    $testsFailed++
}

# Test 4: Verificar que existe campo 62 con la referencia
$campo62Index = $emvPayload.IndexOf("62")
if ($campo62Index -ne -1) {
    Write-Host "[OK] Test 4: Campo 62 (referencia) existe en el payload" -ForegroundColor Green
    $testsPassed++
    
    # Extraer campo 62 para mostrar
    $campo62LengthStr = $emvPayload.Substring($campo62Index + 2, 2)
    $campo62Length = [int]$campo62LengthStr
    $campo62 = $emvPayload.Substring($campo62Index, 4 + $campo62Length)
    
    Write-Host "   Campo 62: $campo62" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Test 4: Campo 62 (referencia) NO encontrado" -ForegroundColor Red
    $testsFailed++
}

# ───────────────────────────────────────────────────────────────────────
# Resultado Final
# ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RESULTADO FINAL" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Tests pasados:  $testsPassed" -ForegroundColor Green
Write-Host "Tests fallados: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })

Write-Host ""
if ($testsFailed -eq 0) {
    Write-Host "[EXITO] CORRECCION VERIFICADA: Terminal ID es FIJO" -ForegroundColor Green
    Write-Host "        El QR deberia funcionar correctamente en todas las billeteras" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "[FALLO] CORRECCION FALLIDA: Terminal ID no es FIJO" -ForegroundColor Red
    Write-Host "        Revisar archivo: src/lib/qr-helpers.ts" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

