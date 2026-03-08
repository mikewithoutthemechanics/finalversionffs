/**
 * Server Test Script
 * Tests key API endpoints
 */

import 'dotenv/config';
import http from 'http';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

console.log('='.repeat(60));
console.log('🧪 SERVER API TESTS');
console.log('='.repeat(60));
console.log(`Testing against: ${BASE_URL}`);
console.log('');

const tests = [
  { name: 'Health Check', path: '/api/health' },
  { name: 'CSRF Token', path: '/api/csrf-token' },
  { name: 'Google OAuth URL', path: '/api/auth/google/url' },
];

async function testEndpoint(name, path) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode === 200;
        const icon = success ? '✅' : '⚠️';
        console.log(`${icon} ${name}`);
        console.log(`   Status: ${res.statusCode}`);
        if (data) {
          try {
            const json = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(json).substring(0, 80)}...`);
          } catch {
            console.log(`   Response: ${data.substring(0, 80)}...`);
          }
        }
        console.log('');
        resolve({ name, success, status: res.statusCode, data });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
      console.log('');
      resolve({ name, success: false, error: err.message });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`❌ ${name}`);
      console.log(`   Error: Connection timeout`);
      console.log('');
      resolve({ name, success: false, error: 'Timeout' });
    });
  });
}

async function runTests() {
  console.log('Starting tests in 3 seconds...');
  console.log('(Make sure server is running with: npm run dev)');
  console.log('');
  
  await new Promise(r => setTimeout(r, 3000));
  
  const results = [];
  for (const test of tests) {
    results.push(await testEndpoint(test.name, test.path));
  }
  
  console.log('='.repeat(60));
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Is the server running? (npm run dev)');
    console.log('2. Check if port 3000 is in use');
    console.log('3. Check server logs for errors');
  }
  console.log('='.repeat(60));
}

runTests();
