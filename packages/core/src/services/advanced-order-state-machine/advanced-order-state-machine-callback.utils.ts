import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

interface CallbackExecutionParams {
  errorHandler?: ErrorHandler;
  context: string;
  onLogFailure: (message: string) => void;
  failureMessage: string;
}

function handleCallbackFailure(error: unknown, params: CallbackExecutionParams): void {
  if (params.errorHandler) {
    params.errorHandler.handle(error, {
      strategy: RecoveryStrategy.SKIP,
      context: params.context,
    });
  }
  params.onLogFailure(`${params.failureMessage}: ${error}`);
}

export function invokeStateChangeCallback<TTransition>(
  callback: ((transition: TTransition) => void) | undefined,
  transition: TTransition,
  params: CallbackExecutionParams,
): void {
  if (!callback) {
    return;
  }

  try {
    callback(transition);
  } catch (error) {
    handleCallbackFailure(error, params);
  }
}

export function invokeTimeoutCallback(
  callback: (() => void) | undefined,
  params: CallbackExecutionParams,
): void {
  if (!callback) {
    return;
  }

  try {
    callback();
  } catch (error) {
    handleCallbackFailure(error, params);
  }
}

export function invokeErrorCallback(
  callback: ((error: Error) => void) | undefined,
  callbackError: Error,
  params: CallbackExecutionParams,
): void {
  if (!callback) {
    return;
  }

  try {
    callback(callbackError);
  } catch (error) {
    handleCallbackFailure(error, params);
  }
}
