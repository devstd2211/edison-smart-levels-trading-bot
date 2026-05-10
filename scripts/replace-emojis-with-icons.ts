import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

type ReplacementContext = 'template' | 'jsx';

type Replacement = {
  end: number;
  key: string;
  original: string;
  replacement: string;
  start: number;
};

type FileReport = {
  autoFixEligible: boolean;
  changed: boolean;
  path: string;
  replacements: number;
  skippedReason?: string;
};

const ROOT_DIR = process.cwd();
const ICONS_FILE_PATH = path.join(ROOT_DIR, 'packages/core/src/cli/cli-runtime.ts');
const DISCOVERY_ROOTS = ['packages/core/src', 'scripts', 'packages/web-client/src'];
const AUTO_FIX_ROOTS = ['packages/core/src', 'scripts'];
const AUTO_FIX_EXTENSIONS = new Set(['.ts', '.tsx']);
const DISCOVERY_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const DEFAULT_EMOJI_NAME_MAP: Record<string, string> = {
  `${ICONS.warning}`: 'warning',
  `${ICONS.warning}`: 'warning',
  `${ICONS.error}`: 'error',
  `${ICONS.success}`: 'success',
  `${ICONS.test}`: 'test',
  `${ICONS.target}`: 'target',
  `${ICONS.robot}`: 'robot',
  `${ICONS.money}`: 'money',
  `${ICONS.chart}`: 'chart',
  `${ICONS.chart_up}`: 'chart_up',
  `${ICONS.chart_down}`: 'chart_down',
  `${ICONS.folder}`: 'folder',
  `${ICONS.open_folder}`: 'open_folder',
  `${ICONS.page}`: 'page',
  `${ICONS.calendar}`: 'calendar',
  `${ICONS.clipboard}`: 'clipboard',
  `${ICONS.pin}`: 'pin',
  `${ICONS.note}`: 'note',
  `${ICONS.books}`: 'books',
  `${ICONS.package}`: 'package',
  `${ICONS.satellite}`: 'satellite',
  `${ICONS.gem}`: 'gem',
  `${ICONS.save}`: 'save',
  `${ICONS.light_bulb}`: 'light_bulb',
  `${ICONS.thought}`: 'thought',
  `${ICONS.dollar_note}`: 'dollar_note',
  `${ICONS.money_out}`: 'money_out',
  `${ICONS.briefcase}`: 'briefcase',
  `${ICONS.broken_heart}`: 'broken_heart',
  `${ICONS.refresh}`: 'refresh',
  `${ICONS.search}`: 'search',
  `${ICONS.zoom}`: 'zoom',
  `${ICONS.link}`: 'link',
  `${ICONS.wrench}`: 'wrench',
  `${ICONS.muted}`: 'muted',
  `${ICONS.red_circle}`: 'red_circle',
  `${ICONS.green_circle}`: 'green_circle',
  `${ICONS.yellow_circle}`: 'yellow_circle',
  `${ICONS.fire}`: 'fire',
  `${ICONS.stop}`: 'stop',
  `${ICONS.rocket}`: 'rocket',
  `${ICONS.no_entry}`: 'no_entry',
  `${ICONS.alarm}`: 'alarm',
  `${ICONS.door}`: 'door',
  `${ICONS.pray}`: 'pray',
  `${ICONS.brain}`: 'brain',
  `${ICONS.thinking}`: 'thinking',
  `${ICONS.trophy}`: 'trophy',
  `${ICONS.construction}`: 'construction',
  `${ICONS.construction}`: 'construction',
  `${ICONS.ping_pong}`: 'ping_pong',
  `${ICONS.label}`: 'label',
  `${ICONS.label}`: 'label',
  `${ICONS.bolt}`: 'bolt',
  `${ICONS.balance}`: 'balance',
  `${ICONS.balance}`: 'balance',
  `${ICONS.gear}`: 'gear',
  `${ICONS.gear}`: 'gear',
  `${ICONS.white_circle}`: 'white_circle',
  `${ICONS.star}`: 'star',
  `${ICONS.sparkles}`: 'sparkles',
  `${ICONS.alarm_clock}`: 'alarm_clock',
  `${ICONS.stopwatch}`: 'stopwatch',
  `${ICONS.stopwatch}`: 'stopwatch',
  `${ICONS.hourglass}`: 'hourglass',
  `${ICONS.pause}`: 'pause',
  `${ICONS.pause}`: 'pause',
  `${ICONS.no_entry_sign}`: 'no_entry_sign',
  `${ICONS.plug}`: 'plug',
  `${ICONS.microscope}`: 'microscope',
  `${ICONS.party}`: 'party',
  `${ICONS.handshake}`: 'handshake',
  `${ICONS.palette}`: 'palette',
  `${ICONS.controls}`: 'controls',
  `${ICONS.controls}`: 'controls',
  `${ICONS.whale}`: 'whale',
  `${ICONS.bug}`: 'bug',
  `${ICONS.pushpin}`: 'pushpin',
  `${ICONS.ruler}`: 'ruler',
  `${ICONS.book_open}`: 'book_open',
  `${ICONS.megaphone}`: 'megaphone',
  `${ICONS.outbox}`: 'outbox',
  `${ICONS.inbox}`: 'inbox',
  `${ICONS.end}`: 'end',
  `${ICONS.numbers}`: 'numbers',
  `${ICONS.small_blue_diamond}`: 'small_blue_diamond',
  `${ICONS.one_oclock}`: 'one_oclock',
  `${ICONS.candle}`: 'candle',
  `${ICONS.candle}`: 'candle',
  `${ICONS.cabinet}`: 'cabinet',
  `${ICONS.cabinet}`: 'cabinet',
  `${ICONS.shield}`: 'shield',
  `${ICONS.shield}`: 'shield',
  `${ICONS.first_place}`: 'first_place',
  `${ICONS.second_place}`: 'second_place',
  `${ICONS.third_place}`: 'third_place',
  `${ICONS.broom}`: 'broom',
  `${ICONS.tornado}`: 'tornado',
  `${ICONS.tornado}`: 'tornado',
  `${ICONS.info}`: 'info',
  `${ICONS.info}`: 'info',
  `${ICONS.reply_left}`: 'reply_left',
  `${ICONS.reply_left}`: 'reply_left',
  `${ICONS.question}`: 'question',
  `${ICONS.arrow_right}`: 'arrow_right',
  `${ICONS.arrow_right}`: 'arrow_right',
  `${ICONS.arrow_up}`: 'arrow_up',
  `${ICONS.arrow_up}`: 'arrow_up',
  `${ICONS.arrow_down}`: 'arrow_down',
  `${ICONS.arrow_down}`: 'arrow_down',
  `${ICONS.keycap_1}`: 'keycap_1',
  `${ICONS.keycap_2}`: 'keycap_2',
  `${ICONS.keycap_3}`: 'keycap_3',
  `${ICONS.keycap_4}`: 'keycap_4',
};

const EMOJI_REGEX =
  /\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*|[#*0-9]\uFE0F?\u20E3/gu;

function main(): void {
  const write = process.argv.includes('--write');
  const files = collectFiles();
  const iconsSource = fs.readFileSync(ICONS_FILE_PATH, 'utf8');
  const existingIcons = parseExistingIcons(iconsSource);
  const emojiNameMap = buildEmojiNameMap(existingIcons);
  const report: FileReport[] = [];
  const missingIcons = new Map<string, string>();

  for (const relativePath of files) {
    const absolutePath = path.join(ROOT_DIR, relativePath);
    const sourceText = fs.readFileSync(absolutePath, 'utf8');
    const autoFixEligible = isAutoFixEligible(relativePath);

    if (!autoFixEligible) {
      const matches = findProjectEmojiMatches(sourceText, emojiNameMap);
      report.push({
        autoFixEligible,
        changed: false,
        path: relativePath,
        replacements: matches.length,
        skippedReason: matches.length > 0 ? 'detected-only' : undefined,
      });
      continue;
    }

    const result = rewriteFile(relativePath, sourceText, emojiNameMap);
    if (result.replacements.length > 0) {
      for (const replacement of result.replacements) {
        if (!existingIcons.has(replacement.key)) {
          missingIcons.set(replacement.key, replacement.original);
        }
      }
    }

    if (write && result.changed) {
      fs.writeFileSync(absolutePath, result.text, 'utf8');
    }

    report.push({
      autoFixEligible,
      changed: result.changed,
      path: relativePath,
      replacements: result.replacements.length,
    });
  }

  if (write && missingIcons.size > 0) {
    const nextIconsSource = appendMissingIcons(iconsSource, missingIcons);
    fs.writeFileSync(ICONS_FILE_PATH, nextIconsSource, 'utf8');
  }

  printReport(report, missingIcons, write);
}

function collectFiles(): string[] {
  const results: string[] = [];

  for (const root of DISCOVERY_ROOTS) {
    const absoluteRoot = path.join(ROOT_DIR, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    walkDirectory(absoluteRoot, results);
  }

  return results
    .map((absolutePath) => path.relative(ROOT_DIR, absolutePath).replace(/\\/g, '/'))
    .sort((left, right) => left.localeCompare(right));
}

function walkDirectory(directoryPath: string, results: string[]): void {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(nextPath, results);
      continue;
    }
    if (DISCOVERY_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(nextPath);
    }
  }
}

function isAutoFixEligible(relativePath: string): boolean {
  if (relativePath === 'packages/core/src/cli/cli-runtime.ts') {
    return false;
  }
  return AUTO_FIX_ROOTS.some((root) => relativePath.startsWith(`${root}/`)) && AUTO_FIX_EXTENSIONS.has(path.extname(relativePath));
}

function parseExistingIcons(sourceText: string): Set<string> {
  const iconsObjectMatch = sourceText.match(/export const ICONS = \{([\s\S]*?)\}\s+as const;/);
  if (!iconsObjectMatch) {
    throw new Error('Could not locate ICONS object in cli-runtime.ts');
  }

  const keys = new Set<string>();
  const keyRegex = /^\s*([a-zA-Z0-9_]+):/gm;
  let match = keyRegex.exec(iconsObjectMatch[1]);
  while (match) {
    keys.add(match[1]);
    match = keyRegex.exec(iconsObjectMatch[1]);
  }
  return keys;
}

function buildEmojiNameMap(existingIcons: Set<string>): Map<string, string> {
  const map = new Map<string, string>();

  for (const [emoji, key] of Object.entries(DEFAULT_EMOJI_NAME_MAP)) {
    map.set(emoji, key);
    const mojibake = toMojibake(emoji);
    if (mojibake !== emoji) {
      map.set(mojibake, key);
    }
  }

  if (existingIcons.has('demo')) {
    map.set(`${ICONS.target}`, 'target');
    map.set(toMojibake(`${ICONS.target}`), 'target');
  }

  return map;
}

function toMojibake(value: string): string {
  return Buffer.from(value, 'utf8').toString('latin1');
}

function rewriteFile(relativePath: string, sourceText: string, emojiNameMap: Map<string, string>): { changed: boolean; replacements: Replacement[]; text: string } {
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(relativePath));
  const edits: Array<{ end: number; start: number; text: string }> = [];
  const replacements: Replacement[] = [];
  const importPath = resolveIconsImportPath(relativePath);

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node)) {
      if (isModuleSpecifier(node)) {
        return;
      }

      const content = node.text;
      const nextReplacements = findSegmentReplacements(content, emojiNameMap);
      if (nextReplacements.length === 0) {
        return;
      }

      const nextText = isJsxAttributeLiteral(node)
        ? `{${buildTemplateLiteral(content, nextReplacements)}}`
        : buildTemplateLiteral(content, nextReplacements);
      edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: nextText });
      replacements.push(...nextReplacements);
      return;
    }

    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const content = node.text;
      const nextReplacements = findSegmentReplacements(content, emojiNameMap);
      if (nextReplacements.length === 0) {
        return;
      }

      edits.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: buildTemplateLiteral(content, nextReplacements),
      });
      replacements.push(...nextReplacements);
      return;
    }

    if (ts.isTemplateExpression(node)) {
      const nextText = rewriteTemplateExpression(node, sourceFile, emojiNameMap);
      if (!nextText) {
        return;
      }

      edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: nextText.text });
      replacements.push(...nextText.replacements);
      return;
    }

    if (ts.isJsxText(node)) {
      const content = node.getFullText(sourceFile);
      const nextReplacements = findSegmentReplacements(content, emojiNameMap);
      if (nextReplacements.length === 0) {
        return;
      }

      edits.push({
        start: node.getFullStart(),
        end: node.getEnd(),
        text: buildJsxMixedText(content, nextReplacements),
      });
      replacements.push(...nextReplacements);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (edits.length === 0) {
    return { changed: false, replacements, text: sourceText };
  }

  const nextSource = applyEdits(sourceText, edits);
  const withImport = ensureIconsImport(nextSource, relativePath, importPath);
  return { changed: withImport !== sourceText, replacements, text: withImport };
}

function getScriptKind(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (relativePath.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }
  if (relativePath.endsWith('.js')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function isModuleSpecifier(node: ts.StringLiteral): boolean {
  return ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent);
}

function isJsxAttributeLiteral(node: ts.StringLiteral): boolean {
  return ts.isJsxAttribute(node.parent);
}

function resolveIconsImportPath(relativePath: string): string {
  if (relativePath.startsWith('packages/core/src/')) {
    const fromDirectory = path.dirname(path.join(ROOT_DIR, relativePath));
    const toFile = path.join(ROOT_DIR, 'packages/core/src/cli/cli-runtime');
    return normalizeImportPath(path.relative(fromDirectory, toFile));
  }

  if (relativePath.startsWith('scripts/')) {
    return '../packages/core/src/cli/cli-runtime';
  }

  throw new Error(`Unsupported auto-fix path: ${relativePath}`);
}

function normalizeImportPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

function findSegmentReplacements(content: string, emojiNameMap: Map<string, string>): Replacement[] {
  const replacements: Replacement[] = [];
  const occupied = new Array<boolean>(content.length).fill(false);

  const actualMatches = Array.from(content.matchAll(EMOJI_REGEX)).map((match) => ({
    emoji: match[0],
    end: (match.index ?? 0) + match[0].length,
    start: match.index ?? 0,
  }));

  for (const match of actualMatches) {
    const key = emojiNameMap.get(match.emoji) ?? createFallbackIconKey(match.emoji);
    markReplacement(replacements, occupied, {
      start: match.start,
      end: match.end,
      original: match.emoji,
      key,
      replacement: `ICONS.${key}`,
    });
  }

  for (const [emojiOrMojibake, key] of emojiNameMap.entries()) {
    let searchIndex = 0;
    while (searchIndex < content.length) {
      const nextIndex = content.indexOf(emojiOrMojibake, searchIndex);
      if (nextIndex < 0) {
        break;
      }
      markReplacement(replacements, occupied, {
        start: nextIndex,
        end: nextIndex + emojiOrMojibake.length,
        original: isActualEmoji(emojiOrMojibake) ? emojiOrMojibake : restoreEmoji(emojiOrMojibake),
        key,
        replacement: `ICONS.${key}`,
      });
      searchIndex = nextIndex + emojiOrMojibake.length;
    }
  }

  return replacements.sort((left, right) => left.start - right.start);
}

function findProjectEmojiMatches(content: string, emojiNameMap: Map<string, string>): Replacement[] {
  return findSegmentReplacements(content, emojiNameMap);
}

function markReplacement(replacements: Replacement[], occupied: boolean[], replacement: Replacement): void {
  if (replacement.start >= replacement.end) {
    return;
  }
  for (let index = replacement.start; index < replacement.end; index += 1) {
    if (occupied[index]) {
      return;
    }
  }
  for (let index = replacement.start; index < replacement.end; index += 1) {
    occupied[index] = true;
  }
  replacements.push(replacement);
}

function isActualEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}|[#*0-9]\uFE0F?\u20E3/u.test(value);
}

function restoreEmoji(mojibake: string): string {
  return Buffer.from(mojibake, 'latin1').toString('utf8');
}

function createFallbackIconKey(emoji: string): string {
  const suffix = Array.from(emoji)
    .map((character) => character.codePointAt(0)?.toString(16))
    .filter((value): value is string => Boolean(value))
    .join('_');
  return `emoji_${suffix}`;
}

function buildTemplateLiteral(content: string, replacements: Replacement[]): string {
  return buildInterpolatedText(content, replacements, 'template');
}

function buildJsxMixedText(content: string, replacements: Replacement[]): string {
  return buildInterpolatedText(content, replacements, 'jsx');
}

function buildInterpolatedText(content: string, replacements: Replacement[], context: ReplacementContext): string {
  let cursor = 0;
  const fragments: string[] = [];

  for (const replacement of replacements) {
    if (cursor < replacement.start) {
      const plainText = content.slice(cursor, replacement.start);
      if (context === 'template') {
        fragments.push(escapeTemplateText(plainText));
      } else {
        fragments.push(plainText);
      }
    }

    if (context === 'template') {
      fragments.push(`\${${replacement.replacement}}`);
    } else {
      fragments.push(`{${replacement.replacement}}`);
    }
    cursor = replacement.end;
  }

  if (cursor < content.length) {
    const tail = content.slice(cursor);
    fragments.push(context === 'template' ? escapeTemplateText(tail) : tail);
  }

  if (context === 'template') {
    return `\`${fragments.join('')}\``;
  }

  return fragments.join('');
}

function escapeTemplateText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function rewriteTemplateExpression(
  node: ts.TemplateExpression,
  sourceFile: ts.SourceFile,
  emojiNameMap: Map<string, string>,
): { replacements: Replacement[]; text: string } | null {
  const replacements: Replacement[] = [];
  let text = `\`${buildInterpolatedText(node.head.text, findSegmentReplacements(node.head.text, emojiNameMap), 'template').slice(1, -1)}`;

  replacements.push(...findSegmentReplacements(node.head.text, emojiNameMap));

  for (const span of node.templateSpans) {
    text += `\${${span.expression.getText(sourceFile)}}`;
    const literalReplacements = findSegmentReplacements(span.literal.text, emojiNameMap);
    replacements.push(...literalReplacements);
    text += buildInterpolatedText(span.literal.text, literalReplacements, 'template').slice(1, -1);
  }

  text += '`';

  return replacements.length > 0 ? { text, replacements } : null;
}

function applyEdits(sourceText: string, edits: Array<{ end: number; start: number; text: string }>): string {
  const sortedEdits = [...edits].sort((left, right) => right.start - left.start);
  let nextSource = sourceText;
  for (const edit of sortedEdits) {
    nextSource = `${nextSource.slice(0, edit.start)}${edit.text}${nextSource.slice(edit.end)}`;
  }
  return nextSource;
}

function ensureIconsImport(sourceText: string, relativePath: string, importPath: string): string {
  if (relativePath.endsWith('cli-runtime.ts')) {
    return sourceText;
  }

  const exactImportRegex = new RegExp(`(^|\\n)import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapeRegExp(importPath)}['"];?`, 'm');
  const exactMatch = sourceText.match(exactImportRegex);
  if (exactMatch) {
    const currentMembers = exactMatch[2]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (currentMembers.includes('ICONS')) {
      return sourceText;
    }
    const nextMembers = ['ICONS', ...currentMembers].join(', ');
    return sourceText.replace(exactImportRegex, `${exactMatch[1]}import { ${nextMembers} } from '${importPath}';`);
  }

  if (sourceText.includes(`ICONS.`)) {
    const importInsertionIndex = findImportInsertionIndex(sourceText, relativePath);
    if (importInsertionIndex === 0) {
      return `import { ICONS } from '${importPath}';\n${sourceText}`;
    }
    return `${sourceText.slice(0, importInsertionIndex)}\nimport { ICONS } from '${importPath}';${sourceText.slice(importInsertionIndex)}`;
  }

  return sourceText;
}

function findImportInsertionIndex(sourceText: string, relativePath: string): number {
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(relativePath));
  let insertionIndex = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
      insertionIndex = statement.getEnd();
      continue;
    }
    break;
  }

  return insertionIndex;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendMissingIcons(sourceText: string, missingIcons: Map<string, string>): string {
  const insertionPoint = sourceText.indexOf('} as const;');
  if (insertionPoint < 0) {
    throw new Error('Could not append icons to cli-runtime.ts');
  }

  const lines = Array.from(missingIcons.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, emoji]) => `  ${key}: '${toUnicodeEscape(emoji)}',`)
    .join('\n');

  return `${sourceText.slice(0, insertionPoint)}${lines.length > 0 ? `${lines}\n` : ''}${sourceText.slice(insertionPoint)}`;
}

function toUnicodeEscape(value: string): string {
  return Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0);
      if (codePoint === undefined) {
        return character;
      }
      if (codePoint <= 0xffff) {
        return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
      }
      return `\\u{${codePoint.toString(16).toUpperCase()}}`;
    })
    .join('');
}

function printReport(report: FileReport[], missingIcons: Map<string, string>, write: boolean): void {
  const changedFiles = report.filter((entry) => entry.changed);
  const detectedOnly = report.filter((entry) => entry.skippedReason === 'detected-only' && entry.replacements > 0);
  const totalReplacements = report.reduce((sum, entry) => sum + entry.replacements, 0);

  console.log(`${write ? 'WRITE' : 'DRY RUN'} | files scanned: ${report.length}`);
  console.log(`Auto-fix candidates changed: ${changedFiles.length}`);
  console.log(`Emoji replacements detected: ${totalReplacements}`);

  if (changedFiles.length > 0) {
    console.log('\nChanged files:');
    for (const entry of changedFiles.slice(0, 50)) {
      console.log(`  ${entry.path} (${entry.replacements})`);
    }
  }

  if (detectedOnly.length > 0) {
    console.log('\nDetected only (outside safe auto-fix scope):');
    for (const entry of detectedOnly.slice(0, 50)) {
      console.log(`  ${entry.path} (${entry.replacements})`);
    }
  }

  if (missingIcons.size > 0) {
    console.log('\nMissing ICONS keys to add:');
    for (const [key, emoji] of Array.from(missingIcons.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
      console.log(`  ${key} = ${emoji}`);
    }
  }
}

main();
