export type StandaloneScriptConsole = Pick<typeof console, 'log' | 'error'>;

export const STANDALONE_SECTION_DIVIDER = '========================================';

export function createStandaloneBannerLines(
  title: string,
  icon: string,
): [string, string, string] {
  return [
    `\n${STANDALONE_SECTION_DIVIDER}`,
    `${icon} ${title}`,
    `${STANDALONE_SECTION_DIVIDER}\n`,
  ];
}

export function createStandaloneFooterLine(message: string): string {
  return `${message}\n`;
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
  printStandaloneScriptLines(consoleRef, createStandaloneBannerLines(title, icon));
}

export function printStandaloneScriptFooter(
  consoleRef: StandaloneScriptConsole,
  message: string,
): void {
  printStandaloneScriptLines(consoleRef, [createStandaloneFooterLine(message)]);
}
