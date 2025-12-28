// Script para probar el cálculo de CRC sobre diferentes payloads
const { crc16ccitt, crc16xmodem, crc16kermit } = require('crc');

/**
 * Calcula CRC16-CCITT manual (como en Python)
 */
function calculateCRC16CCITT_Manual(data) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  const bytes = Buffer.from(data, 'utf8');
  
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    crc ^= (byte << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc & 0xFFFF;
}

/**
 * Prueba diferentes algoritmos CRC sobre un payload
 */
function testCRC(payload, expectedCRC = null) {
  console.log('='.repeat(60));
  console.log('PAYLOAD:');
  console.log(payload);
  console.log('');
  console.log('Longitud:', payload.length, 'caracteres');
  console.log('');
  
  const results = {
    'crc16ccitt (lib)': crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0'),
    'crc16xmodem (lib)': crc16xmodem(payload).toString(16).toUpperCase().padStart(4, '0'),
    'crc16kermit (lib)': crc16kermit(payload).toString(16).toUpperCase().padStart(4, '0'),
    'Manual (0xFFFF)': calculateCRC16CCITT_Manual(payload).toString(16).toUpperCase().padStart(4, '0'),
  };
  
  console.log('RESULTADOS CRC:');
  for (const [algo, result] of Object.entries(results)) {
    const match = expectedCRC && result === expectedCRC.toUpperCase() ? ' ✅' : '';
    console.log(`  ${algo.padEnd(25)}: ${result}${match}`);
  }
  
  if (expectedCRC) {
    console.log('');
    console.log(`Esperado: ${expectedCRC.toUpperCase()}`);
    const matches = Object.entries(results).filter(([_, result]) => result === expectedCRC.toUpperCase());
    if (matches.length > 0) {
      console.log(`✅ Coincide con: ${matches.map(([algo]) => algo).join(', ')}`);
    } else {
      console.log('❌ Ningún algoritmo coincide');
    }
  }
  
  console.log('');
}

// Ejemplo 1: Payload del log actual
const payloadLog = '00020101021226490002AR012201103432300343175379290213SALE-9A8619DC52045492530303254062500005802AR5912Toludev shop6009Argentina62170513SALE-9A8619DC6304';
console.log('EJEMPLO 1: Payload del log actual');
testCRC(payloadLog);

// Ejemplo 2: Payload proporcionado por el usuario
const payloadUsuario = '00020101021226490002AR012201103432300343175379290213SALE-A7FA937452045492530303254064800005802AR5912Toludev shop6009Argentina62170513SALE-A7FA9374636304';
console.log('\n');
console.log('EJEMPLO 2: Payload del usuario (con 6304)');
testCRC(payloadUsuario, '8680');

// Ejemplo 3: Payload sin el 6304 al final (solo para verificar)
const payloadSin6304 = '00020101021226490002AR012201103432300343175379290213SALE-A7FA937452045492530303254064800005802AR5912Toludev shop6009Argentina62170513SALE-A7FA937463';
console.log('\n');
console.log('EJEMPLO 3: Payload sin 6304 (solo para comparar)');
testCRC(payloadSin6304);

console.log('');
console.log('INSTRUCCIONES:');
console.log('1. Copia el payload completo del log del servidor');
console.log('2. Reemplaza "TU_PAYLOAD_AQUI" en este script');
console.log('3. Ejecuta: node test-crc-payload.js');
console.log('4. Compara los resultados con el CRC esperado (8680)');

