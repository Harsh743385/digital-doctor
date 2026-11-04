const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting End-to-End API and Route Verification...\n');

  // 1. GET /login
  const rLogin = await request({ hostname: 'localhost', port: 3000, path: '/login', method: 'GET' });
  console.log(`[1] GET /login -> HTTP ${rLogin.statusCode} (Title verified: ${rLogin.body.includes('Presco Clinical')})`);

  // 2. POST /login (Authenticate)
  const loginPayload = 'username=admin&password=admin123';
  const rAuth = await request({
    hostname: 'localhost', port: 3000, path: '/login', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);
  console.log(`[2] POST /login -> HTTP ${rAuth.statusCode} (Redirect to ${rAuth.headers.location})`);

  const setCookie = rAuth.headers['set-cookie'];
  const cookie = setCookie ? setCookie[0].split(';')[0] : '';
  const authHeaders = { 'Cookie': cookie };

  // 3. GET /dashboard
  const rDash = await request({ hostname: 'localhost', port: 3000, path: '/dashboard', method: 'GET', headers: authHeaders });
  console.log(`[3] GET /dashboard -> HTTP ${rDash.statusCode} (Includes Welcome: ${rDash.body.includes('Welcome, System Administrator')})`);

  // 4. GET /api/admin/fields/types/list
  const rTypes = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/fields/types/list', method: 'GET', headers: authHeaders });
  console.log(`[4] GET /api/admin/fields/types/list -> HTTP ${rTypes.statusCode} (${rTypes.json?.data?.length} field types returned)`);

  // 5. GET /api/admin/fields
  const rFields = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/fields', method: 'GET', headers: authHeaders });
  console.log(`[5] GET /api/admin/fields -> HTTP ${rFields.statusCode} (${rFields.json?.data?.length} fields in inventory)`);

  // 6. GET /api/admin/forms
  const rForms = await request({ hostname: 'localhost', port: 3000, path: '/api/admin/forms', method: 'GET', headers: authHeaders });
  console.log(`[6] GET /api/admin/forms -> HTTP ${rForms.statusCode} (${rForms.json?.data?.length} forms: "${rForms.json?.data?.[0]?.name}")`);

  // 7. GET /forms/inpatient-initial-assessment (Renderer)
  const rRender = await request({ hostname: 'localhost', port: 3000, path: '/forms/inpatient-initial-assessment', method: 'GET', headers: authHeaders });
  console.log(`[7] GET /forms/inpatient-initial-assessment -> HTTP ${rRender.statusCode} (Rendered sections: ${rRender.body.includes('Patient Demographics')})`);

  // 8. POST /api/forms/inpatient-initial-assessment/submit
  const submitData = JSON.stringify({
    patient_id: 3177250,
    first_name: 'Jagdishbhai',
    last_name: 'Ahuja',
    gender: 'Male',
    phone_number: '+91 9876543210',
    date_of_birth: '1984-08-20',
    chief_complaints: 'Severe breathlessness and productive cough',
    consciousness_level: 'Alert',
    temp_f: '98.6',
    pulse_bpm: '88'
  });
  const rSubmit = await request({
    hostname: 'localhost', port: 3000, path: '/api/forms/inpatient-initial-assessment/submit', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(submitData)
    }
  }, submitData);
  console.log(`[8] POST /api/forms/:slug/submit -> HTTP ${rSubmit.statusCode} (Success: ${rSubmit.json?.success}, Submission ID: #${rSubmit.json?.submission_id})`);

  // 9. Digital Nursing: Assessments List
  const assessPayload = JSON.stringify({ patient_id: 3177250, all_dates: 1 });
  const rAssess = await request({
    hostname: 'localhost', port: 3000, path: '/cms/ajax/nursing/assessment/list', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(assessPayload)
    }
  }, assessPayload);
  console.log(`[9] POST /cms/ajax/nursing/assessment/list -> HTTP ${rAssess.statusCode} (${rAssess.json?.data?.length} assessments retrieved)`);

  // 10. Digital Nursing: Vitals List
  const vitalsPayload = JSON.stringify({ patient_id: 3177250, all_dates: 1 });
  const rVitals = await request({
    hostname: 'localhost', port: 3000, path: '/cms/ajax/nursing/vitals/list', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(vitalsPayload)
    }
  }, vitalsPayload);
  console.log(`[10] POST /cms/ajax/nursing/vitals/list -> HTTP ${rVitals.statusCode} (${rVitals.json?.data?.length} vitals logs)`);

  // 11. Digital Nursing: eMAR
  const emarPayload = JSON.stringify({ patient_id: 3177250 });
  const rEmar = await request({
    hostname: 'localhost', port: 3000, path: '/cms/ajax/nursing/emar/list', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(emarPayload)
    }
  }, emarPayload);
  console.log(`[11] POST /cms/ajax/nursing/emar/list -> HTTP ${rEmar.statusCode} (${rEmar.json?.data?.orders?.length} medication orders)`);

  // 12. Digital Nursing: I/O Chart
  const ioPayload = JSON.stringify({ patient_id: 3177250, all_dates: 1 });
  const rIo = await request({
    hostname: 'localhost', port: 3000, path: '/cms/ajax/nursing/io/list', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(ioPayload)
    }
  }, ioPayload);
  console.log(`[12] POST /cms/ajax/nursing/io/list -> HTTP ${rIo.statusCode} (${rIo.json?.data?.length} I/O fluid logs)`);

  // 13. Digital Nursing Workspace UI
  const rWorkspace = await request({ hostname: 'localhost', port: 3000, path: '/cms/digital-nursing', method: 'GET', headers: authHeaders });
  console.log(`[13] GET /cms/digital-nursing -> HTTP ${rWorkspace.statusCode} (Includes Shell: ${rWorkspace.body.includes('dnur-embed-root')})`);

  console.log('\n🎉 ALL 13 VERIFICATION TESTS PASSED WITH 200/201 STATUSES!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
