/**
 * Environment Variables Test
 * Verifies .env file is loaded correctly
 */

import 'dotenv/config';

console.log('='.repeat(60));
console.log('🔧 ENVIRONMENT VARIABLES TEST');
console.log('='.repeat(60));
console.log('');

const tests = [
  { name: 'VITE_SUPABASE_URL', value: process.env.VITE_SUPABASE_URL, required: true },
  { name: 'VITE_SUPABASE_ANON_KEY', value: process.env.VITE_SUPABASE_ANON_KEY, required: true },
  { name: 'SUPABASE_SERVICE_KEY', value: process.env.SUPABASE_SERVICE_KEY, required: false },
  { name: 'GOOGLE_CLIENT_ID', value: process.env.GOOGLE_CLIENT_ID, required: false },
  { name: 'GOOGLE_CLIENT_SECRET', value: process.env.GOOGLE_CLIENT_SECRET, required: false },
  { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY, required: false },
  { name: 'OPENROUTER_API_KEY', value: process.env.OPENROUTER_API_KEY, required: false },
  { name: 'RESEND_API_KEY', value: process.env.RESEND_API_KEY, required: false },
  { name: 'APP_URL', value: process.env.APP_URL, required: false },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const isSet = !!test.value;
  const icon = isSet ? '✅' : (test.required ? '❌' : '⚠️');
  const status = isSet ? 'SET' : (test.required ? 'MISSING' : 'optional');
  const display = isSet 
    ? `${test.value.substring(0, 40)}${test.value.length > 40 ? '...' : ''}` 
    : 'NOT CONFIGURED';
  
  console.log(`${icon} ${test.name}: ${status}`);
  if (isSet) {
    console.log(`   Value: ${display}`);
  }
  
  if (isSet || !test.required) {
    passed++;
  } else {
    failed++;
  }
}

console.log('');
console.log('='.repeat(60));
console.log(`Results: ${passed}/${tests.length} passed`);

if (failed > 0) {
  console.log('❌ Some required variables are missing!');
  process.exit(1);
} else {
  console.log('✅ Environment loaded successfully!');
}
console.log('='.repeat(60));
