import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetDirs = [
  path.join(rootDir, 'node_modules', '@revolist'),
  path.join(rootDir, 'node_modules', '.vite'),
];

function patchContent(content) {
  let modified = content;

  // 1. Patch isHost to recognize any Host object or node with isHost flag
  modified = modified.replace(
    /var isHost = \(node\) => node && node\.\$tag\$ === Host;/g,
    'var isHost = (node) => Boolean(node && (node.$tag$ === Host || (typeof node.$tag$ === "object" && node.$tag$ !== null) || ((node.$flags$ & 4) !== 0)));'
  );

  // 2. Patch createElm so that non-string tags never get passed to createElementNS/createElement
  modified = modified.replace(
    /\? "slot-fb" : newVNode2\.\$tag\$/g,
    '? "slot-fb" : (typeof newVNode2.$tag$ === "string" && newVNode2.$tag$ ? newVNode2.$tag$ : "div")'
  );

  // 3. Patch updateElement null safety
  if (modified.includes('const elm = newVnode.$elm$.nodeType') && !modified.includes('if (!newVnode || !newVnode.$elm$) return;')) {
    modified = modified.replace(
      /const elm = newVnode\.\$elm\$\.nodeType === 11/g,
      'if (!newVnode || !newVnode.$elm$) return;\n  const elm = newVnode.$elm$.nodeType === 11'
    );
  }

  return modified;
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs')) {
      try {
        const original = fs.readFileSync(fullPath, 'utf8');
        const patched = patchContent(original);
        if (patched !== original) {
          fs.writeFileSync(fullPath, patched, 'utf8');
          console.log(`[patch-revogrid] Successfully patched: ${path.relative(rootDir, fullPath)}`);
        }
      } catch (err) {
        console.warn(`[patch-revogrid] Could not patch ${fullPath}:`, err.message);
      }
    }
  }
}

console.log('[patch-revogrid] Scanning and patching RevoGrid / Stencil files...');
for (const dir of targetDirs) {
  processDirectory(dir);
}
console.log('[patch-revogrid] Done.');
