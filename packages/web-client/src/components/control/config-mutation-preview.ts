import type {
  ConfigMutationPreviewEntryPayload,
  ConfigMutationPreviewSummaryPayload,
} from '@edison/contracts/runtime-api';

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function describeMutationPreviewSummary(summary: ConfigMutationPreviewSummaryPayload): string {
  if (summary.totalChanges === 0) {
    return 'No config changes detected relative to the loaded snapshot.';
  }

  return [
    `${summary.totalChanges} ${pluralize(summary.totalChanges, 'change', 'changes')}`,
    `${summary.addedCount} added`,
    `${summary.updatedCount} updated`,
    `${summary.removedCount} removed`,
  ].join(' | ');
}

export function describeMutationPreviewChange(change: ConfigMutationPreviewEntryPayload): string {
  if (change.kind === 'added') {
    return `Added ${change.nextValue ?? 'null'}`;
  }

  if (change.kind === 'removed') {
    return `Removed ${change.previousValue ?? 'null'}`;
  }

  return `Changed ${change.previousValue ?? 'null'} -> ${change.nextValue ?? 'null'}`;
}
