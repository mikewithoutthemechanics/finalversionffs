// Apply schema using Supabase Management API
// Run with: node apply-schema-management-api.cjs

const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from URL:', SUPABASE_URL);
  process.exit(1);
}

console.log('🔄 Reading schema file...');
const schemaSQL = fs.readFileSync('./supabase/schema.sql', 'utf8');

// Split schema into individual statements
const statements = schemaSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📋 Found ${statements.length} SQL statements to execute`);
console.log('🔄 Project ref:', projectRef);

// Management API endpoint for executing SQL
const MANAGEMENT_API_URL = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

async function executeSQL(statement) {
  try {
    const response = await fetch(MANAGEMENT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: statement })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function applySchema() {
  console.log('\n🔄 Applying schema...\n');
  
  let successful = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const shortStatement = statement.substring(0, 60).replace(/\s+/g, ' ');
    process.stdout.write(`[${i + 1}/${statements.length}] ${shortStatement}... `);

    const result = await executeSQL(statement);
    
    if (result.success) {
      console.log('✅');
      successful++;
    } else {
      console.log('❌');
      failed++;
      errors.push({
        statement: shortStatement,
        error: result.error
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS (non-critical items may be ignored):');
    errors.slice(0, 5).forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.statement}...`);
      console.log(`      ${err.error.substring(0, 100)}`);
    });
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more errors`);
    }
  }
  
  console.log('\n' + (failed === 0 ? '✅ Schema applied successfully!' : '⚠️  Schema applied with some errors'));
}

applySchema().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});