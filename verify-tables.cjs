const ACCESS_TOKEN = 'sbp_804df8a7da74c2c980bfe6535183691ca396a9b3';
const PROJECT_REF = 'lxdtovoakxekjrkexbae';

const MANAGEMENT_API_URL = 'https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query';

const TABLES_TO_VERIFY = [
  'crm_contacts',
  'crm_tasks',
  'crm_pipeline_stages',
  'crm_email_templates',
  'crm_campaigns',
  'disclaimers'
];

async function executeSQL(query) {
  try {
    const response = await fetch(MANAGEMENT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function verifyTables() {
  console.log('🔍 Verifying tables were created...\n');

  let allExist = true;
  const results = [];

  for (const table of TABLES_TO_VERIFY) {
    const result = await executeSQL(`SELECT 1 FROM ${table} LIMIT 1`);
    const exists = result.success;
    results.push({ table, exists, error: result.error });

    if (exists) {
      console.log(`  ✅ ${table}`);
    } else {
      console.log(`  ❌ ${table} - ${result.error}`);
      allExist = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allExist) {
    console.log('✅ All 6 tables verified successfully!');
  } else {
    console.log('❌ Some tables are missing');
    process.exit(1);
  }
}

verifyTables().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});