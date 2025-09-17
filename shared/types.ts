export type PadId = string;

export type SampleMeta = {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  url?: string; // local blob or remote
};

export type Pad = {
  id: PadId;
  name: string;
  color: string;
  sample?: SampleMeta;
  gain: number;
  attack: number;
  decay: number;
  startOffset: number; // seconds
  loop: boolean;
  muted: boolean;
};

export type Transport = {
  playing: boolean;
  bpm: number;
  stepsPerBar: number; // e.g., 16
  bars: number; // loop length in bars
  swing: number; // 0..1
};

export type Pattern = {
  steps: Record<number, PadId[]>; // stepIndex -> list of padIds
  length: number; // in steps
};

export type Project = {
  id: string;
  name: string;
  pads: Pad[];
  pattern: Pattern;
  transport: Transport;
};
