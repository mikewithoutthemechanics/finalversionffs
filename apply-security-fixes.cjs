// Apply Security Fixes Migration to Supabase
// Run with: node apply-security-fixes.js
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
  console.error('   set SUPABASE_PROJECT_REF=your_project_ref && set SUPABASE_ACCESS_TOKEN=your_token && node apply-security-fixes.cjs');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔐 Reading security fixes migration...');
  const migrationSQL = fs.readFileSync('./supabase/security-fixes-migration.sql', 'utf8');
  
  console.log('🔄 Connecting to Supabase Management API...');
  
  try {
    // Execute SQL query via Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: migrationSQL })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Security fixes applied successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.error('❌ Failed to apply security fixes:', response.status);
      console.error('Error:', error);
      
      // Try alternative endpoint
      console.log('\n🔄 Trying SQL Editor API...');
      await trySQLEditorAPI(migrationSQL);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Fallback: Try SQL Editor API
    console.log('\n🔄 Trying alternative method...');
    await trySQLEditorAPI(migrationSQL);
  }
}

async function trySQLEditorAPI(query) {
  try {
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
      console.log('✅ Security fixes applied via SQL Editor API!');
    } else {
      const error = await response.text();
      console.error('❌ SQL Editor API failed:', error);
      console.log('\n💡 Manual workaround:');
      console.log('1. Go to https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql');
      console.log('2. Copy contents of supabase/security-fixes-migration.sql');
      console.log('3. Paste and click Run');
    }
  } catch (error) {
    console.error('❌ Alternative method failed:', error.message);
  }
}

applyMigration();
