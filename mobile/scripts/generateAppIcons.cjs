// Render the existing web logo without introducing a mobile runtime dependency.
// From the repository root:
// npm install --prefix tmp/ecotrack-icon-render --no-audit --no-fund --package-lock=false @resvg/resvg-js
// node mobile/scripts/generateAppIcons.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { Resvg } = require(path.join(root, 'tmp/ecotrack-icon-render/node_modules/@resvg/resvg-js'));
const source = fs.readFileSync(path.join(root, 'web/public/favicon.svg'), 'utf8');
const artwork = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
const letter = artwork.match(/<text[\s\S]*?<\/text>/)[0];
const mono = artwork.replace(/fill="#[a-fA-F0-9]+"/g, 'fill="#FFFFFF"');
const mask = `<defs><mask id="letter-cutout" maskUnits="userSpaceOnUse" x="-22" y="-22" width="108" height="108"><rect x="-22" y="-22" width="108" height="108" fill="white"/>${letter.replace('fill="#FFFFFF"', 'fill="#000000"')}</mask></defs><g mask="url(#letter-cutout)">${mono}</g>`;
const assets = path.join(root, 'mobile/assets');
fs.mkdirSync(assets, { recursive: true });
function render(name, viewBox, contents, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${contents}</svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
  fs.writeFileSync(path.join(assets, name), png);
  console.log(`${name}: ${size} x ${size}`);
}
render('icon.png', '-8 -8 80 80', `<rect x="-8" y="-8" width="80" height="80" fill="#f4f8f1"/>${artwork}`, 1024);
// Leave the logo inside the adaptive icon's central safe area.
render('adaptive-icon.png', '-22 -22 108 108', artwork, 1024);
render('monochrome-icon.png', '-22 -22 108 108', mask, 1024);
render('notification-icon.png', '-4 -4 72 72', mask, 96);
