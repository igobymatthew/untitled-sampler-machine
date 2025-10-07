import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransportBar } from './Transport';
import { useStore } from '../store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  let mockState: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      transport: { playing: false, bpm: 120, bars: 4, stepsPerBar: 16, swing: 0 },
      pattern: { steps: {} },
      pads: [],
      setTransport,
      setBars,
    };
    (useStore as any).mockImplementation((selector: (state: any) => any) => {
      return selector(mockState);
    });
    (useStore as any).getState = () => mockState;
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