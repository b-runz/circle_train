import { minify as minifyHtml } from 'html-minifier-terser';
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';

const DIST = 'dist';
await mkdir(DIST, { recursive: true });

const htmlOpts = {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true,
  minifyCSS: true,
  collapseBooleanAttributes: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
};

function savings(from, to) {
  return `${from} → ${to} B  (${Math.round((1 - to / from) * 100)}% smaller)`;
}

// ── HTML files (inline <script> and <style> minified too) ─────────────────────
for (const file of ['index.html', 'player.html']) {
  const src = await readFile(file, 'utf8');
  const out = await minifyHtml(src, htmlOpts);
  await writeFile(`${DIST}/${file}`, out);
  console.log(`${file.padEnd(14)} ${savings(src.length, out.length)}`);
}

// ── sw.js ─────────────────────────────────────────────────────────────────────
const swResult = await Bun.build({
  entrypoints: ['./sw.js'],
  outdir: DIST,
  minify: true,
  target: 'browser',
});
if (!swResult.success) {
  console.error('sw.js build failed');
  for (const log of swResult.logs) console.error(log);
  process.exit(1);
}
const swSrc = await readFile('sw.js');
const swOut = await readFile(`${DIST}/sw.js`);
console.log(`sw.js          ${savings(swSrc.length, swOut.length)}`);

// ── manifest.json ─────────────────────────────────────────────────────────────
const mSrc = await readFile('manifest.json', 'utf8');
const mOut = JSON.stringify(JSON.parse(mSrc));
await writeFile(`${DIST}/manifest.json`, mOut);
console.log(`manifest.json  ${savings(mSrc.length, mOut.length)}`);

// ── udstraek.enc (binary, copied as-is) ──────────────────────────────────────
try {
  await copyFile('udstraek.enc', `${DIST}/udstraek.enc`);
  const { size } = await stat('udstraek.enc');
  console.log(`udstraek.enc   ${(size / 1024 / 1024).toFixed(1)} MB  (copied as-is)`);
} catch (e) {
  if (e.code === 'ENOENT') {
    console.warn('udstraek.enc   not found — skipped (run encrypt.py to generate it)');
  } else {
    throw e;
  }
}

console.log(`\ndist/ ready`);
