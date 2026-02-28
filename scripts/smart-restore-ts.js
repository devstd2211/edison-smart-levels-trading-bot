#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Умный восстановитель TypeScript из .js + .d.ts файлов
 * Использует .d.ts как основу для типов и .js для имплементации
 */

const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(__dirname, '..', 'src');

function cleanJsCode(jsCode) {
  let code = jsCode;

  // Удаляем "use strict"
  code = code.replace(/^["']use strict["'];?\n?/gm, '');

  // Удаляем Object.defineProperty exports
  code = code.replace(/Object\.defineProperty\(exports,\s*["']__esModule["'],\s*\{\s*value:\s*true\s*\}\);?\n?/g, '');

  // Удаляем exports.X = void 0;
  code = code.replace(/exports\.\w+\s*=\s*void\s*0;?\n?/g, '');

  // Удаляем весь CommonJS boilerplate в начале файла
  code = code.replace(/var __\w+\s*=[\s\S]*?\}\);\n/g, '');

  // Удаляем source map
  code = code.replace(/\/\/# sourceMappingURL=.*/g, '');

  return code;
}

function fixImports(code) {
  let fixed = code;

  // Паттерн 1: const name_1 = require("module")
  fixed = fixed.replace(/const\s+(\w+)_\d+\s*=\s*require\(["']([^"']+)["']\);?/g, (match, name, module) => {
    // Определяем тип импорта по имени модуля
    if (module === 'decimal.js') return `import Decimal from "${module}";`;
    return `import * as ${name} from "${module}";`;
  });

  // Паттерн 2: const name = require("module")
  fixed = fixed.replace(/const\s+(\w+)\s*=\s*require\(["']([^"']+)["']\);?/g, (match, name, module) => {
    if (module === 'decimal.js') return `import Decimal from "${module}";`;
    if (module.startsWith('.')) return `import * as ${name} from "${module}";`;
    return `import ${name} from "${module}";`;
  });

  // Паттерн 3: Деструктуризация const { A, B } = require("module")
  fixed = fixed.replace(/const\s*\{\s*([^}]+)\s*\}\s*=\s*require\(["']([^"']+)["']\);?/g,
    'import { $1 } from "$2";');

  // Исправляем использование импортированных модулей
  // module_1.Something -> module.Something
  fixed = fixed.replace(/(\w+)_\d+\./g, '$1.');

  return fixed;
}

function fixExports(code) {
  let fixed = code;

  // exports.ClassName = ClassName; -> export { ClassName };
  fixed = fixed.replace(/exports\.(\w+)\s*=\s*(\w+);?\n/g, (match, name1, name2) => {
    if (name1 === name2) return `export { ${name1} };\n`;
    return `export { ${name2} as ${name1} };\n`;
  });

  // exports.constName = value; -> export const constName = value;
  fixed = fixed.replace(/exports\.(\w+)\s*=\s*/g, 'export const $1 = ');

  return fixed;
}

function addTypeAnnotations(jsCode, dtsCode) {
  if (!dtsCode) return jsCode;

  let code = jsCode;

  // Извлекаем импорты типов из .d.ts
  const typeImports = [];
  const dtsImportRegex = /import\s+(?:type\s+)?{([^}]+)}\s+from\s+["']([^"']+)["'];/g;
  let match;
  while ((match = dtsImportRegex.exec(dtsCode)) !== null) {
    typeImports.push(`import type { ${match[1]} } from "${match[2]}";`);
  }

  // Добавляем type импорты в начало файла после обычных импортов
  if (typeImports.length > 0 && !code.includes('import type')) {
    const firstClassMatch = code.match(/\nclass\s+/);
    if (firstClassMatch) {
      const insertPos = firstClassMatch.index;
      code = code.slice(0, insertPos) + '\n' + typeImports.join('\n') + code.slice(insertPos);
    }
  }

  return code;
}

function processFile(jsPath, dtsPath, tsPath) {
  const jsCode = fs.readFileSync(jsPath, 'utf-8');
  const dtsCode = fs.existsSync(dtsPath) ? fs.readFileSync(dtsPath, 'utf-8') : null;

  let tsCode = jsCode;

  // Шаг 1: Очистка от артефактов компиляции
  tsCode = cleanJsCode(tsCode);

  // Шаг 2: Исправление импортов
  tsCode = fixImports(tsCode);

  // Шаг 3: Исправление экспортов
  tsCode = fixExports(tsCode);

  // Шаг 4: Добавление типов из .d.ts
  tsCode = addTypeAnnotations(tsCode, dtsCode);

  // Шаг 5: Убираем лишние пустые строки
  tsCode = tsCode.replace(/\n{3,}/g, '\n\n');

  // Шаг 6: Убираем дублирующиеся export
  const lines = tsCode.split('\n');
  const seen = new Set();
  const filtered = lines.filter(line => {
    if (line.startsWith('export {') || line.startsWith('export const')) {
      if (seen.has(line)) return false;
      seen.add(line);
    }
    return true;
  });
  tsCode = filtered.join('\n');

  return tsCode.trim() + '\n';
}

function processDirectory(distPath, srcPath) {
  if (!fs.existsSync(srcPath)) {
    fs.mkdirSync(srcPath, { recursive: true });
  }

  const files = fs.readdirSync(distPath);
  let processedCount = 0;

  for (const file of files) {
    const distFilePath = path.join(distPath, file);
    const stat = fs.statSync(distFilePath);

    if (stat.isDirectory()) {
      const newSrcPath = path.join(srcPath, file);
      processedCount += processDirectory(distFilePath, newSrcPath);
    } else if (file.endsWith('.js') && !file.endsWith('.map')) {
      const tsFileName = file.replace('.js', '.ts');
      const srcFilePath = path.join(srcPath, tsFileName);
      const dtsFilePath = distFilePath.replace('.js', '.d.ts');

      try {
        const tsCode = processFile(distFilePath, dtsFilePath, srcFilePath);
        fs.writeFileSync(srcFilePath, tsCode, 'utf-8');
        console.log(`✓ ${srcFilePath.replace(process.cwd(), '.')}`);
        processedCount++;
      } catch (error) {
        console.error(`✗ Ошибка при обработке ${file}: ${error.message}`);
      }
    }
  }

  return processedCount;
}

console.log('🔄 Умное восстановление TypeScript из dist/ (используя .js + .d.ts)...\n');

const count = processDirectory(distDir, srcDir);

console.log(`\n✅ Восстановлено ${count} файлов!`);
console.log('⚠️  Следующие шаги:');
console.log('   1. npm run build - проверить компиляцию');
console.log('   2. Исправить оставшиеся ошибки типов вручную');
console.log('   3. Добавить недостающие type annotations');

