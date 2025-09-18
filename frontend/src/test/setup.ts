import '@testing-library/jest-dom';
import { vi } from 'vitest';

class MockAudioContext {
  createGain() {
    return {
      gain: { value: 0 },
      connect: vi.fn(),
    };
  }
  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      onended: vi.fn(),
    };
  }
  decodeAudioData() {
    return Promise.resolve({});
  }
  get currentTime() {
    return 0;
  }
  resume() {
    return Promise.resolve();
  }
}

(window as any).AudioContext = vi.fn().mockImplementation(() => new MockAudioContext());
