const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/Harsh/.gemini/antigravity/brain/1efe51fe-9ca7-41b8-a577-4e2a00b9bce4/presco_tabbb/Presco Tab_files/digital-nursing.html';
let html = fs.readFileSync(srcPath, 'utf8');

// 1. Remove hardcoded CSRF token and inject EJS csrfToken
html = html.replace(/<meta name="csrf-token" content="[^"]*">/, '<meta name="csrf-token" content="<%= csrfToken || \'\' %>">');

// 2. Fix CSS links to use Edge CDNs
html = html.replace(/<link rel="stylesheet" href="\.\/all\.min\.css">/, '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">');
html = html.replace(/<link rel="stylesheet" href="\.\/bootstrap\.min\.css">/, '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">');
html = html.replace(/<link rel="stylesheet" href="\.\/select2\.min\.css">/, '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.0.13/dist/css/select2.min.css">');
html = html.replace(/<link rel="stylesheet" href="\.\/select2-bootstrap4\.min\.css">/, '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ttskch/select2-bootstrap4-theme@1.5.2/dist/select2-bootstrap4.min.css">');
html = html.replace(/<link rel="stylesheet" href="\.\/sweetalert2\.min\.css">/, '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.min.css">');
html = html.replace(/<link rel="stylesheet" href="\.\/toastr\.min\.css">/, '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css"><link rel="stylesheet" href="/css/presco-theme.css">');

// 3. Fix Script links to use Edge CDNs
html = html.replace(/<script src="\.\/jquery\.min\.js\.download"><\/script>/, '<script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>');
html = html.replace(/<script src="\.\/popper\.min\.js\.download"><\/script>/, '<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>');
html = html.replace(/<script src="\.\/bootstrap\.bundle\.min\.js\.download"><\/script>/, '<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>');
html = html.replace(/<script src="\.\/select2\.min\.js\.download"><\/script>/, '<script src="https://cdn.jsdelivr.net/npm/select2@4.0.13/dist/js/select2.min.js"></script>');
html = html.replace(/<script src="\.\/sweetalert2\.all\.min\.js\.download"><\/script>/, '<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11.10.6/dist/sweetalert2.all.min.js"></script>');
html = html.replace(/<script src="\.\/toastr\.min\.js\.download"><\/script>/, '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>');

// 4. Replace remote prescoipd.com URLs with local routes
html = html.split('https://prescoipd.com/v1/ipd/cms/ajax/nursing/').join('/cms/ajax/nursing/');
html = html.split('https://prescoipd.com/v1/ipd/').join('/');

// 5. Parameterize PID, HID, PNM in the JavaScript engine
html = html.replace(/const PID\s*=\s*\d+;/, 'const PID = <%= patient.id %>;');
html = html.replace(/const HID\s*=\s*\d+;/, 'const HID = <%= hospital.id %>;');
html = html.replace(/const PNM\s*=\s*"[^"]*";/, 'const PNM = <%- JSON.stringify(patient.full_name) %>;');

// 6. Inject top Presco navbar at start of <body>
const navbarCode = `
<%- include('../partials/navbar') %>
`;
html = html.replace(/<body[^>]*>/, `<body>\n${navbarCode}`);

// 7. Enhance patient banner to include dynamic EJS fields and Patient Switcher Dropdown
const patientBannerSearch = /<div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:10px;">[\s\S]*?UHID:[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

const enhancedPatientBanner = `
<div style="display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px; padding:12px 18px; background:#fff; border-radius:14px; border:1px solid var(--grey-200); box-shadow:0 1px 3px rgba(0,0,0,0.04);">
  <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
    <div style="width:42px;height:42px;background:linear-gradient(135deg, var(--teal), var(--teal-d));color:#fff;border-radius:12px;
                display:inline-flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 8px rgba(20,184,166,0.3);">
      <i class="fas fa-user-nurse"></i>
    </div>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--grey-900);display:flex;align-items:center;gap:8px;">
        <span><%= patient.full_name %></span>
        <span class="badge" style="background:var(--teal-l);color:var(--teal-d);font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;"><%= patient.ward || 'General Ward' %> · Bed <%= patient.bed_number || 'B-01' %></span>
      </div>
      <div style="font-size:12px;color:var(--grey-500);margin-top:2px;">
        <b>UHID:</b> <%= patient.uhid %> &nbsp;·&nbsp;
        <b>IPD:</b> <%= patient.ipd_number %> &nbsp;·&nbsp;
        <b>Age/Gender:</b> <%= patient.age %> / <%= patient.gender %> &nbsp;·&nbsp;
        <b>DOA:</b> <%= patient.admission_date || '2026-10-30' %> &nbsp;·&nbsp;
        <b>Dr:</b> Dr. Suresh Patel, MD
      </div>
    </div>
  </div>

  <div style="display:flex; align-items:center; gap:10px;">
    <!-- Patient Switcher Dropdown with all 10 demo patients -->
    <div class="dropdown">
      <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" id="ptSwitchBtn" data-toggle="dropdown" style="border-radius:8px;font-weight:600;">
        <i class="fas fa-exchange-alt mr-1 text-teal"></i> Switch Patient (<%= allPatients.length %>)
      </button>
      <div class="dropdown-menu dropdown-menu-right" style="max-height:350px; overflow-y:auto; min-width:280px; box-shadow:0 8px 24px rgba(0,0,0,0.12); border-radius:10px;">
        <h6 class="dropdown-header text-uppercase" style="font-size:11px; letter-spacing:0.5px;">Active IPD Census (<%= allPatients.length %>)</h6>
        <% allPatients.forEach(function(p) { %>
          <a class="dropdown-item <%= p.id === patient.id ? 'active bg-light font-weight-bold text-teal' : '' %>" href="/cms/digital-nursing?patient_id=<%= p.id %>" style="padding:8px 14px; border-bottom:1px solid #f1f5f9;">
            <div style="font-size:13px;"><%= p.full_name %></div>
            <div style="font-size:11px; color:#64748b;"><%= p.uhid %> | Bed <%= p.bed_number %> (<%= p.ward %>)</div>
          </a>
        <% }); %>
      </div>
    </div>

    <!-- Doctor Workstation Link -->
    <a href="/cms/digital-doctor?patient_id=<%= patient.id %>" class="btn btn-sm btn-outline-primary" style="border-radius:8px;font-weight:600;" title="Switch to Doctor Workstation">
      <i class="fas fa-user-md mr-1"></i> Doctor View
    </a>
  </div>
</div>
`;

html = html.replace(patientBannerSearch, enhancedPatientBanner);

// 8. Make sure all pills are visible (remove display:none on nurseTabs items)
html = html.replace(/<li style="display:\s*none;"><div class="pill"/g, '<li><div class="pill"');

// 9. Include salary popup before the LAST REAL </body> tag only (not inside JS strings!)
const lastBodyIdx = html.lastIndexOf('</body>');
if (lastBodyIdx !== -1) {
  html = html.substring(0, lastBodyIdx) + "<%- include('../partials/salary-popup') %>\n" + html.substring(lastBodyIdx);
}

// Write to views/nursing/workspace.ejs
const targetPath = path.join(__dirname, '../views/nursing/workspace.ejs');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('views/nursing/workspace.ejs successfully generated without JS leak! Size:', html.length);
