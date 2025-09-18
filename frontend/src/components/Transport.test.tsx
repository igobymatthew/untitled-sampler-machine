import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransportBar } from './Transport';
import { useStore } from '../store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store');

describe('TransportBar', () => {
  const setTransport = vi.fn();
  const setBars = vi.fn();

  const mockState = {
    transport: { playing: false, bpm: 120, bars: 4, stepsPerBar: 16, swing: 0 },
    pattern: { steps: {} },
    pads: [],
    setTransport,
    setBars,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as any).mockImplementation((selector: (state: any) => any) => {
      return selector(mockState);
    });
    // Mock getState as well for the scheduler
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
