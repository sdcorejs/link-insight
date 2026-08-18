interface ListenerEvent<TListener extends (...arguments_: never[]) => void> {
  addListener(listener: TListener): void;
}

interface BackgroundLifecycleDependencies {
  readonly protectStorage: () => Promise<void>;
  readonly openOptionsPage: () => Promise<void>;
  readonly onInstalled: ListenerEvent<(details: { reason: string }) => void>;
  readonly onActionClicked: ListenerEvent<() => void>;
}

export function registerBackgroundLifecycle(dependencies: BackgroundLifecycleDependencies): void {
  runSafely(dependencies.protectStorage);

  dependencies.onInstalled.addListener((details) => {
    runSafely(dependencies.protectStorage);
    if (details.reason === 'install') {
      runSafely(dependencies.openOptionsPage);
    }
  });

  dependencies.onActionClicked.addListener(() => {
    runSafely(dependencies.openOptionsPage);
  });
}

function runSafely(operation: () => Promise<void>): void {
  void operation().catch(() => undefined);
}
