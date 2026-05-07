import { Heartbeat, Tickable } from '../../src/engine/heartbeat';

describe('Heartbeat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  it('calls subscribers based on frequency', async () => {
    const sub1 = { name: 'sub1', frequency: 1, onTick: jest.fn() };
    const sub2 = { name: 'sub2', frequency: 2, onTick: jest.fn() };
    
    const heartbeat = new Heartbeat(100);
    heartbeat.subscribe(sub1);
    heartbeat.subscribe(sub2);
    
    heartbeat.start();
    await flushPromises(); // Tick 1: sub1 (1%1=0), sub2 (1%2=1)
    
    expect(sub1.onTick).toHaveBeenCalledWith(1);
    expect(sub2.onTick).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    await flushPromises(); // Tick 2: sub1 (2%1=0), sub2 (2%2=0)
    
    expect(sub1.onTick).toHaveBeenCalledTimes(2);
    expect(sub2.onTick).toHaveBeenCalledWith(2);
    
    heartbeat.stop();
  });

  it('continues if a subscriber fails', async () => {
    const sub1 = { name: 'sub1', frequency: 1, onTick: jest.fn().mockRejectedValue(new Error('Fail')) };
    const sub2 = { name: 'sub2', frequency: 1, onTick: jest.fn() };
    
    const heartbeat = new Heartbeat(100);
    heartbeat.subscribe(sub1);
    heartbeat.subscribe(sub2);
    
    heartbeat.start();
    await flushPromises();
    
    expect(sub1.onTick).toHaveBeenCalled();
    expect(sub2.onTick).toHaveBeenCalled();
    
    heartbeat.stop();
  });

  it('allows unsubscribing', async () => {
    const sub1 = { name: 'sub1', frequency: 1, onTick: jest.fn() };
    const heartbeat = new Heartbeat(100);
    
    heartbeat.subscribe(sub1);
    heartbeat.unsubscribe('sub1');
    
    heartbeat.start();
    await flushPromises();
    
    expect(sub1.onTick).not.toHaveBeenCalled();
    heartbeat.stop();
  });
});
