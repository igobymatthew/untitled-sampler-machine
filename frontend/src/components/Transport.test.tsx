import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransportBar } from './Transport';
import { useStore } from '../store';

type SchedulerCallback = (when: number, stepInBar: number, absoluteStep: number) => void;

const playBuffer = vi.fn();
const getBuffer = vi.fn();

declare global {
  // eslint-disable-next-line no-var
  var __schedulerCallback: SchedulerCallback | undefined;
}

vi.mock('../audio/Engine', () => ({
  engine: {
    resume: vi.fn(),
    ctx: { currentTime: 0 },
  },
}));

vi.mock('../audio/SamplePlayer', () => ({
  playBuffer: (...args: unknown[]) => playBuffer(...args),
}));

vi.mock('../audio/BufferStore', () => ({
  getBuffer: (...args: unknown[]) => getBuffer(...args),
}));

vi.mock('../audio/Scheduler', () => ({
  Scheduler: vi.fn().mockImplementation((cb: SchedulerCallback) => {
    ;(globalThis as { __schedulerCallback?: SchedulerCallback }).__schedulerCallback = cb;
    return {
      set: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }),
}));

vi.mock('../store');

// Mock the slider component
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: { value: number[], onValueChange: (value: number[]) => void }) => {
    return (
      <input
        type="range"
        role="slider"
        value={value[0]}
        onChange={(e) => onValueChange([Number(e.target.value)])}
        {...props}
      />
    );
  },
}));

describe('TransportBar', () => {
  const setTransport = vi.fn();
  const setBars = vi.fn();
  const setPattern = vi.fn();
  const mockSetState = vi.fn();

  let mockState: any;
  beforeEach(() => {
    vi.clearAllMocks();
    playBuffer.mockReset();
    getBuffer.mockReset();
    mockSetState.mockReset();
    mockSetState.mockImplementation(updater => {
      if (typeof updater === 'function') {
        const result = updater(mockState);
        mockState = { ...mockState, ...result };
        return;
      }
      mockState = { ...mockState, ...updater };
    });
    mockState = {
      transport: { playing: false, bpm: 120, bars: 4, stepsPerBar: 16, swing: 0 },
      pattern: { steps: {}, length: 64 },
      pads: [],
      currentStep: 0,
      setTransport,
      setBars,
      setPattern,
    };
    (useStore as any).mockImplementation((selector: (state: any) => any) => {
      return selector(mockState);
    });
    (useStore as any).getState = () => mockState;
    (useStore as any).setState = mockSetState;
  });

  it('renders the BPM label', () => {
    render(<TransportBar />);
    expect(screen.getByText('BPM')).toBeInTheDocument();
  });

  it('toggles play/stop button', async () => {
    render(<TransportBar />);
    const button = screen.getByText('Play');
    fireEvent.click(button);
    await waitFor(() => {
      expect(setTransport).toHaveBeenCalledWith({ playing: true });
    });
  });

  it('changes BPM', () => {
    render(<TransportBar />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '140' } });
    expect(setTransport).toHaveBeenCalledWith({ bpm: 140 });
  });

  it('advances currentStep into the second bar for two-bar patterns', () => {
    mockState.transport = { playing: false, bpm: 120, bars: 2, stepsPerBar: 16, swing: 0 };
    mockState.pattern = {
      steps: {
        16: ['pad-2'],
      },
      length: 32,
    };
    mockState.pads = [
      {
        id: 'pad-2',
        muted: false,
        gain: 1,
        attack: 0,
        decay: 0,
        startOffset: 0,
        loop: false,
      },
    ];
    getBuffer.mockReturnValue({});

    render(<TransportBar />);
    expect(typeof (globalThis as { __schedulerCallback?: SchedulerCallback }).__schedulerCallback).toBe('function');
    (globalThis as { __schedulerCallback?: SchedulerCallback }).__schedulerCallback?.(0, 0, 16);

    expect(mockState.currentStep).toBe(16);
    expect(playBuffer).toHaveBeenCalledTimes(1);
    expect(getBuffer).toHaveBeenCalledWith('pad-2');
  });
});

describe('Slider Component', () => {
  it('renders multiple thumbs for a range slider', async () => {
    const { Slider: RealSlider } = await vi.importActual<
      typeof import('@/components/ui/slider')
    >('@/components/ui/slider');
    render(<RealSlider defaultValue={[10, 80]} max={100} />);
    const thumbs = screen.getAllByRole('slider');
    expect(thumbs).toHaveLength(2);
  });
});