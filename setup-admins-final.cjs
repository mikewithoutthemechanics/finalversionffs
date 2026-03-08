#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lxdtovoakxekjrkexbae.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ADMINS = [
  { email: 'zelda@thefasciadome.co.za', name: 'Zelda' },
  { email: 'jo@thefasciadome.co.za', name: 'Jo' },
  { email: 'michaelgraemek@gmail.com', name: 'Michael Graeme' }
];

async function main() {
  console.log('🔌 Connecting to Supabase...\n');
  
  // Step 1: Check if users table exists and see its structure
  const { data: columns, error: colError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'users')
    .eq('table_schema', 'public');
  
  if (colError) {
    console.log('⚠️  Could not check columns, proceeding...');
  } else {
    const hasIsAdmin = columns?.some(c => c.column_name === 'isAdmin');
    console.log(`isAdmin column exists: ${hasIsAdmin ? '✅ Yes' : '❌ No'}`);
    
    if (!hasIsAdmin) {
      console.log('\n⚠️  IMPORTANT: You need to run this SQL in Supabase SQL Editor:');
      console.log('\n   ALTER TABLE public.users ADD COLUMN "isAdmin" BOOLEAN DEFAULT false;');
      console.log('\n   👉 https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql-editor');
      console.log('\n   After that, run this script again.');
      process.exit(1);
    }
  }
  
  // Step 2: Set admins
  console.log('\n👤 Setting up admin users...\n');
  
  for (const admin of ADMINS) {
    // Check if exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, isAdmin')
      .eq('email', admin.email)
      .single();
    
    if (existing) {
      // Update to admin
      const { error } = await supabase
        .from('users')
        .update({ isAdmin: true, updated_at: new Date().toISOString() })
        .eq('email', admin.email);
      
      console.log(error 
        ? `❌ ${admin.email}: ${error.message}`
        : `✅ ${admin.email}: Updated to admin`
      );
    } else {
      // Insert new admin
      const { error } = await supabase
        .from('users')
        .insert({
          id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          email: admin.email,
          name: admin.name,
          isAdmin: true,
          waiverAccepted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      console.log(error 
        ? `❌ ${admin.email}: ${error.message}`
        : `✅ ${admin.email}: Created as admin`
      );
    }
  }
  
  // Step 3: Verify
  console.log('\n📋 Current admin users:\n');
  const { data: admins, error } = await supabase
    .from('users')
    .select('email, name, isAdmin, created_at')
    .eq('isAdmin', true);
  
  if (!error && admins) {
    console.table(admins);
  }
  
  console.log('\n✨ Done! Admins can now access: https://tfmdbooking.vercel.app');
}

main().catch(console.error);
