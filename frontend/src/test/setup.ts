import '@testing-library/jest-dom';
import { vi } from 'vitest';
vi.mock('@react-three/fiber', () => ({
  __esModule: true,
  Canvas: () => null,
  useFrame: vi.fn(),
}));

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1024,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

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