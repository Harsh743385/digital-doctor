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

// 4. Inject a quick return-to-dashboard shortcut in header
const returnBtn = `<a href="/dashboard" title="Back to Presco Dashboard" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold mr-2 transition backdrop-blur-sm shadow-sm" style="text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Dashboard</span></a>`;

html = html.replace(/(<header [^>]*style="background-color:\s*#67C2FF;"[^>]*>)/i, `$1\n${returnBtn}`);

const outDir = path.join(__dirname, '../views/pwa');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const targetPath = path.join(outDir, 'tab.ejs');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('views/pwa/tab.ejs generated successfully! Size:', html.length);

