const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxdtovoakxekjrkexbae.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

const supabase = createClient(supabaseUrl, serviceKey);

async function addAdminColumn() {
  console.log('Adding isAdmin column to users table...\n');
  
  try {
    // Use raw SQL to add the column
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;
      `
    });
    
    if (error) {
      console.error('❌ Error adding column via RPC:', error.message);
      console.log('\nTrying alternative approach with REST API...');
      
      // Try alternative using REST
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({
          query: 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;'
        })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ REST API failed:', text);
      } else {
        console.log('✅ Column added via REST API');
      }
    } else {
      console.log('✅ isAdmin column added successfully');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

addAdminColumn();
