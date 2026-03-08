// Simple test script to verify Supabase connection
// Run with: node test-supabase-connection.js
//
// Required environment variables:
//   SUPABASE_URL - Your Supabase project URL (e.g., https://yourproject.supabase.co)
//   SUPABASE_ANON_KEY - Your Supabase anon/public key

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  console.error('');
  console.error('Example usage:');
  console.error('   set SUPABASE_URL=https://yourproject.supabase.co && set SUPABASE_ANON_KEY=your_anon_key && node test-supabase-connection.js');
  process.exit(1);
}

async function testConnection() {
  console.log('🔄 Testing Supabase connection...\n');
  
  try {
    // Test 1: Basic connectivity
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase API is reachable');
    } else {
      console.log('❌ Supabase API returned error:', response.status);
    }
    
    // Test 2: Try to fetch from app_settings table
    console.log('\n🔄 Testing app_settings table...');
    const settingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (settingsResponse.status === 200) {
      const data = await settingsResponse.json();
      console.log('✅ app_settings table exists');
      console.log('   Data:', JSON.stringify(data, null, 2));
    } else if (settingsResponse.status === 404) {
      console.log('❌ app_settings table does not exist (schema not applied)');
    } else {
      console.log('⚠️  app_settings returned status:', settingsResponse.status);
      const text = await settingsResponse.text();
      console.log('   Response:', text);
    }
    
    // Test 3: Try to fetch from users table
    console.log('\n🔄 Testing users table...');
    const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (usersResponse.status === 200) {
      const data = await usersResponse.json();
      console.log('✅ users table exists');
      console.log('   Row count:', data.length);
    } else if (usersResponse.status === 404) {
      console.log('❌ users table does not exist (schema not applied)');
    } else {
      console.log('⚠️  users returned status:', usersResponse.status);
    }
    
    console.log('\n✅ Connection test complete!');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check your internet connection');
    console.log('2. Verify the SUPABASE_URL is correct');
    console.log('3. Verify the SUPABASE_ANON_KEY is valid');
    console.log('4. Ensure the Supabase project is active (not paused)');
  }
}

testConnection();
