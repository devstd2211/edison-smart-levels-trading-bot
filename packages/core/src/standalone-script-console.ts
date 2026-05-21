export type StandaloneScriptConsole = Pick<typeof console, 'log' | 'error'>;

const STANDALONE_SECTION_DIVIDER = '========================================';

export function printStandaloneScriptBanner(
  consoleRef: StandaloneScriptConsole,
  title: string,
  icon: string,
): void {
  consoleRef.log(`\n${STANDALONE_SECTION_DIVIDER}`);
  consoleRef.log(`${icon} ${title}`);
  consoleRef.log(`${STANDALONE_SECTION_DIVIDER}\n`);
}

export function printStandaloneScriptFooter(
  consoleRef: StandaloneScriptConsole,
  message: string,
): void {
  consoleRef.log(`${message}\n`);
}
