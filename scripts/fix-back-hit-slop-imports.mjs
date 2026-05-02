/**
 * Ensures BACK_NAVIGATION_HIT_SLOP is imported from constants wherever it's used in JSX.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(p);
  }
  return out;
}

function hasImport(content) {
  return (
    /import\s*\{[^}]*\bBACK_NAVIGATION_HIT_SLOP\b[^}]*\}\s*from/.test(content) ||
    /import\s+BACK_NAVIGATION_HIT_SLOP\s+from/.test(content)
  );
}

function addImport(content, filePath) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('import ') || !line.includes('from ')) continue;
    if (!line.includes('constants') && !line.includes("/constants'") && !line.includes('/constants"')) continue;
    const m = line.match(/^import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/);
    if (!m) continue;
    if (m[1].includes('BACK_NAVIGATION_HIT_SLOP')) return content;
    const parts = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    parts.push('BACK_NAVIGATION_HIT_SLOP');
    lines[i] = line.replace(/\{[^}]*\}/, `{ ${parts.join(', ')} }`);
    return lines.join('\n');
  }

  const rel = path.relative(path.dirname(filePath), path.join(ROOT, 'constants')).replace(/\\/g, '/');
  const prefix = rel.startsWith('.') ? '' : './';
  const importLine = `import { BACK_NAVIGATION_HIT_SLOP } from '${prefix}${rel}';`;

  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
    return lines.join('\n');
  }
  return importLine + '\n' + content;
}

let fixed = 0;
for (const f of walk(ROOT)) {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('BACK_NAVIGATION_HIT_SLOP')) continue;
  if (hasImport(c)) continue;
  const next = addImport(c, f);
  if (next !== c) {
    fs.writeFileSync(f, next, 'utf8');
    console.log('import fixed', path.relative(path.join(__dirname, '..'), f));
    fixed++;
  }
}
console.log('imports added:', fixed);
