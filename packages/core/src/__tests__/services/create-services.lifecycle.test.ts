import {
  createManagedTrackedServicesContext,
  spyOnTrackedServiceLifecycle,
} from '../helpers/service-lifecycle-test.utils';

describe('createServices lifecycle orchestration', () => {
  type TrackedServicesFixtureContext = ReturnType<typeof createManagedTrackedServicesContext>;
  type TrackedLifecycleRuntime = Pick<TrackedServicesFixtureContext, 'createInitializerHarness'>;
  type TrackedLifecycleFixtureState = {
    runtime: TrackedLifecycleRuntime;
    cleanup: TrackedServicesFixtureContext['cleanup'];
  };
  let createInitializerHarness: TrackedLifecycleRuntime['createInitializerHarness'];

  function bindTrackedLifecycleFixtures() {
    let fixtureState: TrackedLifecycleFixtureState;

    beforeEach(() => {
      const managedContext = createManagedTrackedServicesContext();
      fixtureState = {
        runtime: {
          createInitializerHarness: managedContext.createInitializerHarness,
        },
        cleanup: managedContext.cleanup,
      };
    });

    afterEach(async () => {
      await fixtureState.cleanup();
    });

    return () => fixtureState.runtime;
  }

  const getFixtures = bindTrackedLifecycleFixtures();

  beforeEach(() => {
    ({ createInitializerHarness } = getFixtures());
  });

  test('services stay idle until explicit bootstrap/start and stop on shutdown', async () => {
    const harness = createInitializerHarness();
    const services = harness.services;
    const initializer = harness.initializer;
    const {
      bybitInitSpy,
      bybitOpenPositionsSpy,
      syncSpy,
      sessionStartSpy,
      sessionEndSpy,
      wsStartSpy,
      wsStopSpy,
      publicStartSpy,
      publicStopSpy,
      monitorStartSpy,
      monitorStopSpy,
    } = spyOnTrackedServiceLifecycle(services);

    // Side-effect-free creation: no lifecycle start calls at construction time.
    expect(bybitInitSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();

    try {
      await initializer.bootstrap();

      expect(bybitInitSpy).toHaveBeenCalledTimes(1);
      expect(bybitOpenPositionsSpy).toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalled();
      expect(sessionStartSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
    } finally {
      await initializer.shutdown();
    }

    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(sessionEndSpy).toHaveBeenCalled();
  });
});
