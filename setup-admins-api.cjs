// Direct API call to Supabase to bypass RLS issues
const https = require('https');

const SUPABASE_URL = 'lxdtovoakxekjrkexbae.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: `/rest/v1/${path}`,
      method: method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    
    if (data && method !== 'GET') {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json?.message || `HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  console.log('🔌 Connecting via REST API...\n');
  
  // Step 1: Get all users
  console.log('Step 1: Checking current users...');
  try {
    const users = await apiRequest('GET', 'users?select=*');
    console.log(`   Found ${users.length} users\n`);
    
    // Check if isAdmin exists
    const hasIsAdmin = users.length > 0 && 'isAdmin' in users[0];
    console.log(`isAdmin column: ${hasIsAdmin ? '✅ exists' : '❌ NOT FOUND'}`);
    
    if (!hasIsAdmin) {
      console.log('\n⚠️  You MUST run this in Supabase SQL Editor first:');
      console.log('\n   ALTER TABLE public.users ADD COLUMN "isAdmin" BOOLEAN DEFAULT false;');
      console.log('\n   👉 https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql-editor');
      return;
    }
    
    // Step 2: Set admins
    console.log('\nStep 2: Setting admin users...\n');
    const admins = [
      { email: 'zelda@thefasciadome.co.za', name: 'Zelda' },
      { email: 'jo@thefasciadome.co.za', name: 'Jo' },
      { email: 'michaelgraemek@gmail.com', name: 'Michael Graeme' }
    ];
    
    for (const admin of admins) {
      const existing = users.find(u => u.email === admin.email);
      
      try {
        if (existing) {
          await apiRequest('PATCH', `users?email=eq.${encodeURIComponent(admin.email)}`, {
            isAdmin: true,
            updated_at: new Date().toISOString()
          });
          console.log(`   ✅ ${admin.email}: Updated`);
        } else {
          await apiRequest('POST', 'users', {
            id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            email: admin.email,
            name: admin.name,
            isAdmin: true,
            waiverAccepted: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          console.log(`   ✅ ${admin.email}: Created`);
        }
      } catch (err) {
        console.log(`   ❌ ${admin.email}: ${err.message}`);
      }
    }
    
    // Verify
    console.log('\nStep 3: Verifying...\n');
    const updated = await apiRequest('GET', 'users?select=email,name,isAdmin&isAdmin=eq.true');
    console.log(`Admin users (${updated.length}):`);
    console.table(updated);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
