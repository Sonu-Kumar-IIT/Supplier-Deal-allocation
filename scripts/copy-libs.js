// Copies the bundled dist files we depend on from node_modules into libs/
// so the portal can run entirely from local files with no CDN dependency.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const libs = path.join(root, 'libs');
fs.mkdirSync(libs, { recursive: true });

const copies = [
  ['node_modules/ag-grid-community/dist/ag-grid-community.min.js', 'ag-grid-community.min.js'],
  ['node_modules/ag-grid-community/styles/ag-grid.css', 'ag-grid.css'],
  ['node_modules/ag-grid-community/styles/ag-theme-alpine.css', 'ag-theme-alpine.css'],
  ['node_modules/chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
];

for (const [src, destName] of copies) {
  const srcPath = path.join(root, src);
  const destPath = path.join(libs, destName);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[copy-libs] skipping missing file: ${src}`);
    continue;
  }
  fs.copyFileSync(srcPath, destPath);
  console.log(`[copy-libs] copied ${src} -> libs/${destName}`);
}
