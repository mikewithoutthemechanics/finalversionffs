/**
 * OAuth Test Script
 * Tests Google OAuth configuration and endpoints
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('='.repeat(60));
console.log('🔐 GOOGLE OAUTH TEST');
console.log('='.repeat(60));

// Test 1: Environment Variables
console.log('\n📋 Test 1: Environment Variables');
console.log('-'.repeat(40));

const required = [
  { name: 'GOOGLE_CLIENT_ID', value: process.env.GOOGLE_CLIENT_ID },
  { name: 'GOOGLE_CLIENT_SECRET', value: process.env.GOOGLE_CLIENT_SECRET },
  { name: 'APP_URL', value: process.env.APP_URL },
];

let allConfigured = true;
for (const env of required) {
  const status = env.value ? '✅ SET' : '❌ MISSING';
  const display = env.value ? `${env.value.substring(0, 30)}...` : 'NOT CONFIGURED';
  console.log(`${status} ${env.name}: ${display}`);
  if (!env.value) allConfigured = false;
}

if (!allConfigured) {
  console.log('\n❌ FAIL: Missing required environment variables');
  process.exit(1);
}

// Test 2: OAuth Client Creation
console.log('\n📋 Test 2: OAuth Client Creation');
console.log('-'.repeat(40));

try {
  const redirectUri = process.env.VERCEL 
    ? `${process.env.APP_URL}/api/auth/google/callback`
    : `http://localhost:3000/api/auth/google/callback`;
    
  console.log(`Redirect URI: ${redirectUri}`);
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  
  console.log('✅ OAuth2 client created successfully');
  
  // Test 3: Generate Auth URL
  console.log('\n📋 Test 3: Generate Auth URL');
  console.log('-'.repeat(40));
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  console.log('✅ Auth URL generated successfully');
  console.log(`\n🔗 Auth URL Preview:\n${authUrl.substring(0, 100)}...`);
  
  // Validate URL structure
  const url = new URL(authUrl);
  const requiredParams = ['client_id', 'redirect_uri', 'scope', 'response_type'];
  const missingParams = requiredParams.filter(p => !url.searchParams.has(p));
  
  if (missingParams.length > 0) {
    console.log(`\n❌ Missing URL parameters: ${missingParams.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ URL contains all required parameters');
  console.log(`   - client_id: ${url.searchParams.get('client_id').substring(0, 20)}...`);
  console.log(`   - redirect_uri: ${url.searchParams.get('redirect_uri')}`);
  console.log(`   - scope: ${url.searchParams.get('scope').substring(0, 50)}...`);
  
} catch (error) {
  console.log(`\n❌ FAIL: ${error.message}`);
  process.exit(1);
}

// Test 4: Allowed Origins
console.log('\n📋 Test 4: Allowed Origins Configuration');
console.log('-'.repeat(40));

const allowedOrigins = (process.env.ALLOWED_OAUTH_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.log('⚠️  WARNING: No ALLOWED_OAUTH_ORIGINS configured');
  console.log('   Using default origins only (localhost, APP_URL, VERCEL_URL)');
} else {
  console.log('✅ Allowed origins configured:');
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ ALL OAUTH TESTS PASSED');
console.log('='.repeat(60));
console.log('\n📌 Next Steps:');
console.log('   1. Ensure Google Cloud Console has these redirect URIs:');
console.log(`      - ${process.env.APP_URL}/api/auth/google/callback`);
console.log('      - http://localhost:3000/api/auth/google/callback (for dev)');
console.log('\n   2. Ensure JavaScript origins are authorized:');
console.log(`      - ${process.env.APP_URL}`);
console.log('      - http://localhost:3000 (for dev)');
console.log('\n   3. Test the OAuth flow by visiting:');
console.log('      GET /api/auth/google/url');
console.log('='.repeat(60));
