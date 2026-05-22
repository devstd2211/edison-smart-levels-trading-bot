import * as path from 'path';
import type { EmbeddedDocument } from './vector-db.types';
import {
  determineProjectIndexerCategory,
  determineProjectIndexerDocumentType,
} from './project-indexer-discovery';

export interface FileAnalysis {
  filePath: string;
  type: 'file' | 'module' | 'class' | 'function' | 'service' | 'analyzer' | 'indicator';
  name: string;
  category: string;
  description: string;
  keywords: string[];
  content: string;
  size: number;
}

const INDEXED_CONTENT_PREVIEW_LENGTH = 10000;
const KEYWORD_LIMIT = 20;
const MIN_NAME_PART_LENGTH = 3;
const MIN_IMPORTED_NAME_LENGTH = 3;
const MIN_METHOD_NAME_LENGTH = 3;

export const extractProjectIndexerName = (filePath: string, content: string): string => {
  const fileName = path.basename(filePath);
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (classMatch) {
    return classMatch[1];
  }

  const interfaceMatch = content.match(/export\s+interface\s+(\w+)/);
  if (interfaceMatch) {
    return interfaceMatch[1];
  }

  return fileName.replace(/\.(ts|js)$/, '').replace(/[-_]/g, ' ');
};

export const extractProjectIndexerDescription = (content: string): string => {
  const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n\s*\*/s);
  if (jsdocMatch) {
    return jsdocMatch[1].trim();
  }

  const commentMatch = content.match(/\/\/\s*(.+)/);
  if (commentMatch) {
    return commentMatch[1].trim();
  }

  const docMatch = content.match(/export\s+(?:class|interface)\s+\w+[^{]*{/);
  if (docMatch) {
    const precedingComment = content.substring(0, docMatch.index || 0);
    const lastComment = precedingComment.match(/\/\/\s*(.+?)$/m);
    if (lastComment) {
      return lastComment[1].trim();
    }
  }

  return '';
};

export const extractProjectIndexerKeywords = (content: string, name: string): string[] => {
  const keywords = new Set<string>();

  name.split(/[_\s-]/).forEach((part) => {
    if (part.length > MIN_NAME_PART_LENGTH) {
      keywords.add(part.toLowerCase());
    }
  });

  const importMatches = content.matchAll(/from\s+['"](.*?)['"]/g);
  for (const match of importMatches) {
    const imported = match[1];
    const baseName = path.basename(imported).split('.')[0];
    if (baseName.length > MIN_IMPORTED_NAME_LENGTH) {
      keywords.add(baseName.toLowerCase());
    }
  }

  const methodMatches = content.matchAll(/^\s*(?:public|private)?\s*(\w+)\s*\(/gm);
  for (const match of methodMatches) {
    const method = match[1];
    if (method.length > MIN_METHOD_NAME_LENGTH && method !== 'constructor') {
      keywords.add(method.toLowerCase());
    }
  }

  const keyTerms = [
    'analyzer',
    'indicator',
    'service',
    'signal',
    'candle',
    'position',
    'order',
    'risk',
    'filter',
    'trading',
    'orchestrator',
  ];
  content.toLowerCase().split(/\s+/).forEach((word) => {
    if (keyTerms.some((term) => word.includes(term))) {
      keywords.add(word.toLowerCase());
    }
  });

  return Array.from(keywords).slice(0, KEYWORD_LIMIT);
};

export const analyzeProjectIndexerFile = (
  projectPath: string,
  filePath: string,
  content: string,
): FileAnalysis => {
  const relativeFilePath = path.relative(projectPath, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath);
  const name = extractProjectIndexerName(filePath, content);

  return {
      filePath: relativeFilePath,
    type: determineProjectIndexerDocumentType(fileName),
    name,
    category: determineProjectIndexerCategory(relativeFilePath),
    description: extractProjectIndexerDescription(content),
    keywords: extractProjectIndexerKeywords(content, name),
    content: content.substring(0, INDEXED_CONTENT_PREVIEW_LENGTH),
    size: content.length,
  };
};

export const generateProjectIndexerTags = (analysis: FileAnalysis): string[] => {
  const tags = new Set<string>();

  tags.add(analysis.category);

  if (analysis.content.includes('@deprecated')) tags.add('deprecated');
  if (analysis.content.includes('TODO')) tags.add('todo');
  if (analysis.content.includes('FIXME')) tags.add('fixme');
  if (analysis.content.includes('new[]')) tags.add('array-operations');
  if (analysis.content.includes('async')) tags.add('async');
  if (analysis.content.includes('Entry')) tags.add('entry');
  if (analysis.content.includes('Exit')) tags.add('exit');
  if (analysis.content.includes('Signal')) tags.add('signal');
  if (analysis.content.includes('Risk')) tags.add('risk-management');
  if (analysis.content.includes('Position')) tags.add('position-management');
  if (analysis.content.includes('OrderBook')) tags.add('orderbook');

  return Array.from(tags);
};

export const createProjectIndexerDocument = (
  analysis: FileAnalysis,
  lastUpdated: string = new Date().toISOString(),
): EmbeddedDocument => ({
  id: analysis.filePath.replace(/\\/g, '/'),
  type: analysis.type,
  filePath: analysis.filePath,
  name: analysis.name,
  description: analysis.description,
  category: analysis.category,
  tags: generateProjectIndexerTags(analysis),
  content: analysis.content,
  keywords: analysis.keywords,
  size: analysis.size,
  lastUpdated,
  relatedModules: [],
});

export const countProjectIndexerLines = (documents: EmbeddedDocument[]): number =>
  documents.reduce((total, document) => total + document.content.split('\n').length, 0);

export const countProjectIndexerDocumentsByCategory = (
  documents: EmbeddedDocument[],
): Record<string, number> =>
  documents.reduce<Record<string, number>>((counts, document) => {
    counts[document.category] = (counts[document.category] || 0) + 1;
    return counts;
  }, {});
