export type StandaloneScriptConsole = Pick<typeof console, 'log'>;

export const STANDALONE_SECTION_DIVIDER = '========================================';

function createStandaloneSectionLines(
  message: string,
): [string, string, string] {
  return [
    `\n${STANDALONE_SECTION_DIVIDER}`,
    message,
    `${STANDALONE_SECTION_DIVIDER}\n`,
  ];
}

export function printStandaloneScriptLines(
  consoleRef: StandaloneScriptConsole,
  lines: readonly string[],
): void {
  for (const line of lines) {
    consoleRef.log(line);
  }
}

export function printStandaloneScriptBanner(
  consoleRef: StandaloneScriptConsole,
  title: string,
  icon: string,
): void {
  printStandaloneScriptLines(consoleRef, createStandaloneSectionLines(`${icon} ${title}`));
}

export function printStandaloneScriptMessageBlock(
  consoleRef: StandaloneScriptConsole,
  message: string,
  icon: string,
): void {
  printStandaloneScriptLines(consoleRef, createStandaloneSectionLines(`${icon} ${message}`));
}

export function printStandaloneScriptFooter(
  consoleRef: StandaloneScriptConsole,
  message: string,
): void {
  printStandaloneScriptLines(consoleRef, [`${message}\n`]);
}
