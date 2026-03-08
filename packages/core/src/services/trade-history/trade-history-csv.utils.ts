export function buildCsvLineForSchema(
  schema: string[],
  record: Record<string, unknown>,
): string {
  const values: string[] = [];

  for (const field of schema) {
    const value = record[field];

    if (value === undefined || value === null) {
      values.push('');
      continue;
    }

    if (typeof value === 'string') {
      const escaped = value.replace(/"/g, '""');
      values.push(`"${escaped}"`);
      continue;
    }

    values.push(String(value));
  }

  return values.join(',');
}

export function splitCsvLinePreservingQuotes(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}
