/**
 * Health Check API Endpoint for Vercel
 */

export default async function handler(_req: Request) {
  return new Response(
    JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}
