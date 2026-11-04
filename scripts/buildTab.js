const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/Harsh/.gemini/antigravity/brain/1efe51fe-9ca7-41b8-a577-4e2a00b9bce4/presco_tabbb/Presco Tab.html';
let html = fs.readFileSync(srcPath, 'utf8');

// 1. Remove chrome extension float dock style
html = html.replace(/<style id="it-float-dock-style">[\s\S]*?<\/style>/gi, '');

// 2. Remove chrome extension injected elements
html = html.replace(/<div id="it-float-dock-handle"[\s\S]*?<\/div>/gi, '');
html = html.replace(/<div id="it-sidebar-drawer-container"[\s\S]*?<\/div>\s*<\/div>/gi, '');

// 3. Fix asset paths
html = html.split('./Presco Tab_files/presco-logo.png').join('/pwa/files/presco-logo.png');
html = html.split('./Presco Tab_files/digital-nursing.html').join('/cms/digital-nursing');
html = html.split('./Presco Tab_files/').join('/pwa/files/');

// 4. Fix _ipdUrl to never prepend remote https://prescoipd.com/v1/ipd
html = html.replace(
  /_ipdUrl\(path\)\s*\{\s*const base = \(this\.me && this\.me\.app_url\) \|\| 'https:\/\/prescoipd\.com\/v1\/ipd';\s*return base \+ \(path \|\| ''\);\s*\}/g,
  `_ipdUrl(path) { return path || ''; }`
);

// 5. Enable can_digital_nursing and other permissions in initial me state
html = html.replace(
  /can_digital_nursing:\s*false/g,
  'can_digital_nursing: true'
);
html = html.replace(
  /can_digital_doctor:\s*false/g,
  'can_digital_doctor: true'
);
html = html.replace(
  /can_edit_pages:\s*false/g,
  'can_edit_pages: true'
);
html = html.replace(
  /can_clone_pages:\s*false/g,
  'can_clone_pages: true'
);

// 6. Ensure openWebPage automatically auto-selects first patient if none selected yet
html = html.replace(
  /if\s*\(!this\.selectedPatientId\)\s*\{\s*this\.showToast\('Select a patient first',\s*'error'\);\s*return;\s*\}/,
  `if (!this.selectedPatientId) {
      if (this.patients && this.patients.length > 0) {
          this.selectPatient(this.patients[0]);
      } else {
          this.showToast('Select a patient first', 'error');
          return;
      }
  }`
);

// 7. Inject top action bar buttons into the header (Dashboard + Digital Nursing + Digital Doctor)
const headerButtons = `
  <div class="flex items-center gap-1.5 mr-2">
    <a href="/dashboard" title="Back to Presco Dashboard" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition backdrop-blur-sm shadow-sm" style="text-decoration:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span class="hidden sm:inline">Dashboard</span>
    </a>
    <button type="button" @click="openWebPage('Digital Nursing', '/cms/digital-nursing', 'bg-cyan-600')" title="Open Digital Nursing Inside Tablet" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition shadow-sm border border-cyan-400/40">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>
      <span>Digital Nursing</span>
    </button>
    <a href="/cms/digital-nursing" target="_blank" title="Open Digital Nursing in New Window" class="inline-flex items-center px-2 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs transition" style="text-decoration:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>
  </div>
`;

html = html.replace(/(<header [^>]*style="background-color:\s*#67C2FF;"[^>]*>)/i, `$1\n${headerButtons}`);

// 8. Auto-open Digital Nursing if query param has open=nursing or tab=nursing
html = html.replace(
  /this\._resolveDeviceIdentity\(\);/,
  `this._resolveDeviceIdentity();
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('open') === 'nursing' || searchParams.get('tab') === 'nursing') {
      setTimeout(() => {
          if (this.patients && this.patients.length > 0 && !this.selectedPatientId) {
              this.selectPatient(this.patients[0]);
          }
          this.openWebPage('Digital Nursing', '/cms/digital-nursing', 'bg-cyan-600');
      }, 350);
  }`
);

const outDir = path.join(__dirname, '../views/pwa');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const targetPath = path.join(outDir, 'tab.ejs');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('views/pwa/tab.ejs rebuilt successfully! Size:', html.length);
