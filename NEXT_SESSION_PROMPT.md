# Next Session Prompt

You are continuing a refactor in `D:\src\Edison`.

Current artifacts:
- `REFACTOR_PLAN.md` contains the global plan and per‑area checklists.
- `REFACTOR_TASKS.md` contains issue‑ready task lists by area.

Focus for this session:
1. Start with DI + Containers (Area A) and prepare the dependency map.
2. Identify the smallest safe slice to refactor first, without touching runtime behavior.

Steps to do:
1. Open `src/services/bot-services.ts` and enumerate all services and their dependencies.
2. Create `docs/architecture/dependency-map.md` with a flat list of services and immediate dependencies.
3. Propose the first migration slice, likely a non‑critical adapter such as `BotWebAPI` or a read‑only service group.
4. Do not modify runtime paths yet. Keep changes minimal and focused on architecture scaffolding.

Constraints:
- Keep constructors side‑effect free when introducing new containers.
- Avoid changing behavior until the dependency map and minimal interfaces are in place.

Deliverables for this session:
- `docs/architecture/dependency-map.md`
- A short summary of the first migration slice and why it is low‑risk.

## Current Status (as of 2026-02-26)
- Domain-type migration in services/strategies/tests is complete via legacy re-exports.
- Multi-strategy module exports now re-export from legacy.
- Tests not run.

## Next Session Start
- Consider next slice: reduce/remove `BotServices` to thin adapter (REFACTOR_PLAN Step 1 remaining).
