/**
 * Adds hitSlop={BACK_NAVIGATION_HIT_SLOP} to TouchableOpacity / Pressable opens
 * when the control calls goBack/onBack and shows a back arrow.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'src');

const SKIP_FILES = new Set(['BackNavTouchable.tsx', 'ArrowBackIcon.tsx', 'ChevronBackIcon.tsx']);

const hasBackNavIntent = (openTag, forward) => {
  const block = openTag + forward;
  const hasArrow = /arrow-back|chevron-back|ArrowBackIcon|ChevronBackIcon/.test(block);
  if (!hasArrow) return false;
  if (/navigation\.goBack\s*\(|onBack\s*\(\)/.test(block)) return true;
  // Handlers defined outside the opening tag (common pattern)
  if (/onPress=\{\s*(handleGoBack|handleBack|goBackToSecurity)\s*\}/.test(openTag)) return true;
  return false;
};

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function addHitSlopImport(content, filePath) {
  // Body already uses constant but import must still be added — do not early-return on JSX usage alone.
  if (/import\s*\{[^}]*\bBACK_NAVIGATION_HIT_SLOP\b[^}]*\}\s*from/.test(content)) return content;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('import ') || !line.includes('from ') || !line.includes('constants')) continue;
    const m = line.match(/^import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/);
    if (!m) continue;
    const brace = m[1];
    if (brace.includes('BACK_NAVIGATION_HIT_SLOP')) return content;
    const parts = brace.split(',').map((s) => s.trim()).filter(Boolean);
    parts.push('BACK_NAVIGATION_HIT_SLOP');
    const newBrace = parts.join(', ');
    lines[i] = line.replace(/\{[^}]*\}/, `{ ${newBrace} }`);
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

function patchOpens(content) {
  let result = content;
  for (const tag of ['TouchableOpacity', 'Pressable']) {
    let searchPos = 0;
    while (true) {
      const idx = result.indexOf(`<${tag}`, searchPos);
      if (idx === -1) break;

      const head = result.slice(idx, idx + 120);
      if (head.includes('BACK_NAVIGATION_HIT_SLOP')) {
        searchPos = idx + 2;
        continue;
      }

      let end = idx + `<${tag}`.length;
      while (end < result.length && result[end] !== '>') end++;
      if (end >= result.length) break;

      const openTag = result.slice(idx, end + 1);
      const forward = result.slice(end + 1, end + 4500);

      if (!hasBackNavIntent(openTag, forward)) {
        searchPos = idx + 2;
        continue;
      }

      const replacement = openTag.replace(`<${tag}`, `<${tag} hitSlop={BACK_NAVIGATION_HIT_SLOP}`);
      result = result.slice(0, idx) + replacement + result.slice(end + 1);
      searchPos = idx + replacement.length;
    }
  }
  return result;
}

function processFile(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILES.has(base)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  if ((!content.includes('goBack') && !content.includes('onBack')) || !/arrow-back|chevron-back|ArrowBackIcon|ChevronBackIcon/.test(content)) {
    return false;
  }

  const patched = patchOpens(content);
  if (patched === content) return false;

  const final = addHitSlopImport(patched, filePath);
  fs.writeFileSync(filePath, final, 'utf8');
  return true;
}

const files = walk(ROOT);
let n = 0;
for (const f of files) {
  if (processFile(f)) {
    console.log('patched', path.relative(path.join(__dirname, '..'), f));
    n++;
  }
}
console.log('done, patched files:', n);
