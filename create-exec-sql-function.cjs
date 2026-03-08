// Create the exec_sql function using REST API
// This function allows executing SQL via the REST API

const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// SQL to create the exec_sql function
const CREATE_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`;

async function createExecSqlFunction() {
  console.log('🔄 Attempting to create exec_sql function...\n');
  
  // Method 1: Try pg-meta API
  console.log('Method 1: Trying pg-meta API...');
  try {
    const response = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: CREATE_FUNCTION_SQL })
    });
    
    if (response.ok) {
      console.log('✅ exec_sql function created via pg-meta API\n');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ pg-meta API failed:', error.substring(0, 200));
    }
  } catch (err) {
    console.log('❌ pg-meta API error:', err.message);
  }
  
  // Method 2: Try direct REST API with X-Client-Info header
  console.log('\nMethod 2: Trying REST API...');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'X-Client-Info': 'supabase-js/2.0'
      },
      body: JSON.stringify({ sql: CREATE_FUNCTION_SQL })
    });
    
    if (response.ok || response.status === 204) {
      console.log('✅ exec_sql function might already exist\n');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ REST API failed:', error.substring(0, 200));
    }
  } catch (err) {
    console.log('❌ REST API error:', err.message);
  }
  
  console.log('\n⚠️  Could not create exec_sql function automatically.');
  console.log('   Manual SQL execution is required.\n');
  return false;
}

createExecSqlFunction().then(success => {
  if (success) {
    console.log('✅ You can now run the schema migration scripts.');
    process.exit(0);
  } else {
    console.log('❌ Please run the following SQL manually in the Supabase SQL Editor:');
    console.log('\n--- COPY BELOW ---');
    console.log(CREATE_FUNCTION_SQL);
    console.log('--- COPY ABOVE ---\n');
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});