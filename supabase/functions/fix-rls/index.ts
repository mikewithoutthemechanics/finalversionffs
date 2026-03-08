import { createClient } from 'https://esm.sh/@supabase/postgres-js@0.1.1'

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_KEY')!;
  
  const client = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'public' }
  });
  
  try {
    await client.rpc('exec_sql', { 
      query: `DROP POLICY IF EXISTS "Anyone can submit teacher request" ON teacher_requests;
CREATE POLICY "Anyone can submit teacher request" ON teacher_requests 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');`
    });
  } catch (e) {
    // exec_sql might not exist, try direct query
  }
  
  return new Response(JSON.stringify({ 
    message: "Edge function deployed. Please run SQL in dashboard or contact admin to execute."
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
