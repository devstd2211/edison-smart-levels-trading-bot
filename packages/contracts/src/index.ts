/**
 * Compatibility root barrel.
 *
 * @deprecated Prefer `@edison/contracts/web-api` and
 * `@edison/contracts/runtime-api` in new code.
 *
 * Workspace consumers should prefer the focused `@edison/contracts/web-api`
 * and `@edison/contracts/runtime-api` entrypoints so the publishable surface
 * can narrow over time without forcing source-path imports.
 */
export * from './web-api';
export * from './runtime-api';
