// tests/test-all.js
// ═══════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════════

const { execSync } = require('child_process');

const tests = [
  { name: 'Email Service', file: 'tests/test-01-email.js' },
  { name: 'Recharge Flow', file: 'tests/test-02-recharge.js' },
  { name: 'Projected Balance', file: 'tests/test-03-projected.js' },
  { name: 'Alert Decision', file: 'tests/test-04-alert.js' },
];

async function runAll() {
  console.log('\n' + '█'.repeat(70));
  console.log('🧪 RUNNING ALL TESTS');
  console.log('█'.repeat(70));

  const results = [];

  for (const test of tests) {
    console.log(`\n▶️  Running: ${test.name}...`);
    try {
      execSync(`node ${test.file}`, { 
        stdio: 'inherit',
        env: { ...process.env }
      });
      results.push({ name: test.name, passed: true });
    } catch (error) {
      results.push({ name: test.name, passed: false });
    }
  }

  // ─── Summary ─────────────────────────────────────────────────
  console.log('\n' + '█'.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('█'.repeat(70));
  
  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  const passed = results.filter(r => r.passed).length;
  console.log(`\n  Total: ${passed}/${results.length} passed`);
  console.log('█'.repeat(70) + '\n');

  process.exit(passed === results.length ? 0 : 1);
}

runAll();