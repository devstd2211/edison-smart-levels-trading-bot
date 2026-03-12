import { getErrorMessage } from '../../utils/error.utils';

export function toErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}
