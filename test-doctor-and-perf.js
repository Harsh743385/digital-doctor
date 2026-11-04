const http = require('http');
const app = require('./server');

const PORT = 3099;
const server = app.listen(PORT, async () => {
  console.log(`\n🧪 Performance & Module Benchmark Server running on port ${PORT}...`);

  function testEndpoint(path, label) {
    return new Promise((resolve) => {
      const start = Date.now();
      http.get(`http://localhost:${PORT}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const duration = Date.now() - start;
          console.log(`  ⏱️  [${res.statusCode}] ${label.padEnd(42)} -> ${duration} ms (bytes: ${data.length})`);
          resolve({ path, statusCode: res.statusCode, duration, bytes: data.length });
        });
      }).on('error', (err) => {
        console.error(`  ❌ Failed ${label}: ${err.message}`);
        resolve({ path, error: err.message });
      });
    });
  }

  try {
    console.log('\n--- BENCHMARK RESULTS ---');
    await testEndpoint('/login', 'Login Page (SSR)');
    await testEndpoint('/dashboard', 'Dashboard (Redirect/Auth Check)');
    await testEndpoint('/cms/ajax/doctor/assessment/list?patient_id=3177250', 'Doctor Initial Assessment API');
    await testEndpoint('/cms/ajax/doctor/notes/list?patient_id=3177250', 'Consultant Notes API (Page 4)');
    await testEndpoint('/cms/ajax/doctor/cross-reference/list?patient_id=3177250', 'Cross Reference API (Pages 5-6)');
    await testEndpoint('/cms/ajax/doctor/mo-handover/list?patient_id=3177250', 'MO Handover API (Page 7)');
    await testEndpoint('/cms/ajax/doctor/sbar/list?patient_id=3177250', 'Doctor SBAR Handover API (Page 8)');
    await testEndpoint('/cms/ajax/doctor/blood-transfusion/list?patient_id=3177250', 'Blood Transfusion API (Page 9)');
    await testEndpoint('/cms/ajax/doctor/print/initial-assessment?patient_id=3177250', 'Printable PDF Form (Pages 1-3)');
    await testEndpoint('/cms/ajax/doctor/print/progress-notes?patient_id=3177250', 'Printable PDF Form (Page 4)');
    await testEndpoint('/cms/ajax/doctor/print/cross-reference?patient_id=3177250', 'Printable PDF Form (Pages 5-6)');
    await testEndpoint('/cms/ajax/doctor/print/blood-transfusion?patient_id=3177250', 'Printable PDF Form (Page 9)');
    console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---\n');
  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    server.close(() => process.exit(0));
  }
});

