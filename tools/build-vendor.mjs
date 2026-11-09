// Bundles the used parts of three.js into site/vendor/three.min.js (kept in git so the site has no build step).
import { build } from 'esbuild';
import { copyFile, mkdir, stat } from 'node:fs/promises';
await mkdir(new URL('../site/vendor/', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('./three-entry.js', import.meta.url).pathname],
  bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'none',
  outfile: new URL('../site/vendor/three.min.js', import.meta.url).pathname,
  banner: { js: '/* three.js r187 (MIT, https://threejs.org), tree-shaken for Ludo Adda. See LICENSE-three.txt */' },
});
await copyFile(new URL('../node_modules/three/LICENSE', import.meta.url), new URL('../site/vendor/LICENSE-three.txt', import.meta.url));
console.log('three.min.js:', ((await stat(new URL('../site/vendor/three.min.js', import.meta.url))).size / 1024).toFixed(0), 'KB');
