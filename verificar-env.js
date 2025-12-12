require('dotenv').config({ path: '.env.local' });

const url = process.env.DATABASE_URL || '';

console.log('\n=== Verificación de DATABASE_URL ===\n');

if (!url) {
  console.log('❌ DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}

console.log('✅ DATABASE_URL encontrada');
console.log('Longitud:', url.length, 'caracteres\n');

// Verificar formato
const isPooling = url.includes('pooler.supabase.com');
const isDirect = url.includes('db.') && url.includes('.supabase.co');

console.log('Tipo de conexión:');
if (isPooling) {
  console.log('✅ Connection Pooling (correcto para drizzle-kit)');
} else if (isDirect) {
  console.log('❌ Conexión Directa (puede causar ENOTFOUND)');
  console.log('\n⚠️  Necesitas usar Connection Pooling');
  console.log('   📖 Ver: OBTENER_CONNECTION_POOLING.md');
} else {
  console.log('⚠️  Formato desconocido');
}

// Extraer hostname
const hostnameMatch = url.match(/@([^:]+)/);
if (hostnameMatch) {
  console.log('\nHostname:', hostnameMatch[1]);
}

// Verificar puerto
const portMatch = url.match(/:(\d+)\//);
if (portMatch) {
  const port = portMatch[1];
  console.log('Puerto:', port);
  if (port === '6543') {
    console.log('✅ Puerto correcto para Connection Pooling');
  } else if (port === '5432') {
    console.log('⚠️  Puerto 5432 es para conexión directa');
    console.log('   Debería ser 6543 para Connection Pooling');
  }
}

console.log('\n=== Fin de verificación ===\n');

