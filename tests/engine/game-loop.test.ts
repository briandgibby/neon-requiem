import { GameLoop } from '../../src/engine/game-loop';

describe('GameLoop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  it('calls the tick handler on each tick', async () => {
    const handler = jest.fn();
    const loop = new GameLoop(100, handler);

    loop.start();
    await flushPromises(); // Initial tick
    
    jest.advanceTimersByTime(100);
    await flushPromises(); // Second tick
    
    jest.advanceTimersByTime(100);
    await flushPromises(); // Third tick
    
    loop.stop();

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('does not tick after stop() is called', async () => {
    const handler = jest.fn();
    const loop = new GameLoop(100, handler);

    loop.start();
    await flushPromises(); // First tick
    
    loop.stop();
    jest.advanceTimersByTime(300);
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws if start() is called while already running', () => {
    const loop = new GameLoop(100, jest.fn());
    loop.start();
    expect(() => loop.start()).toThrow('GameLoop is already running');
    loop.stop();
  });
});
