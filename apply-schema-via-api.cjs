// Apply Supabase schema using Management API
// Run with: node apply-schema-via-api.js
//
// Required environment variables:
//   SUPABASE_PROJECT_REF - Your Supabase project reference (e.g., lxdtovoakxekjrkexbae)
//   SUPABASE_ACCESS_TOKEN - Your Supabase access token (from https://supabase.com/dashboard/account/tokens)

const fs = require('fs');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!PROJECT_REF || !ACCESS_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN must be set');
  console.error('');
  console.error('Example usage:');
  console.error('   set SUPABASE_PROJECT_REF=your_project_ref && set SUPABASE_ACCESS_TOKEN=your_token && node apply-schema-via-api.cjs');
  process.exit(1);
}

async function applySchema() {
  console.log('🔄 Reading schema file...');
  const schemaSQL = fs.readFileSync('./supabase/schema.sql', 'utf8');
  
  console.log('🔄 Connecting to Supabase Management API...');
  
  try {
    // Execute SQL query via Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: schemaSQL })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Schema applied successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.error('❌ Failed to apply schema:', response.status);
      console.error('Error:', error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Fallback: Try SQL Editor API
    console.log('\n🔄 Trying alternative method...');
    await trySQLEditorAPI(schemaSQL);
  }
}

async function trySQLEditorAPI(query) {
  try {
    // This uses a different endpoint
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: query,
        mode: 'sequential'
      })
    });
    
    if (response.ok) {
      console.log('✅ Schema applied via SQL Editor API!');
    } else {
      const error = await response.text();
      console.error('❌ SQL Editor API failed:', error);
      console.log('\n💡 Manual workaround:');
      console.log('1. Go to https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql');
      console.log('2. Copy contents of supabase/schema.sql');
      console.log('3. Paste and click Run');
    }
  } catch (error) {
    console.error('❌ Alternative method failed:', error.message);
  }
}

applySchema();
