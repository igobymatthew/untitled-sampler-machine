export type PadId = string;

export type SampleMeta = {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  url?: string; // local blob or remote
};

export type ReverbPreset =
  | "off"
  | "room"
  | "hall"
  | "plate"
  | "spring"
  | "shimmer";

export type NoiseGateSettings = {
  enabled: boolean;
  threshold: number; // decibels
  attack: number; // milliseconds
  release: number; // milliseconds
};

export type EqualizerBand =
  | "31"
  | "62"
  | "125"
  | "250"
  | "500"
  | "1k"
  | "2k"
  | "4k"
  | "8k"
  | "16k";

export type EqualizerSettings = Record<EqualizerBand, number>;

export type Pad = {
  id: PadId;
  name: string;
  color: string;
  sample?: SampleMeta;
  gain: number;
  attack: number;
  decay: number;
  startOffset: number; // seconds
  trimStart: number; // seconds
  trimEnd: number | null; // seconds, null -> sample end
  loop: boolean;
  muted: boolean;
  reverbPreset: ReverbPreset;
  reverbMix: number; // 0..1
  noiseGate: NoiseGateSettings;
  eq: EqualizerSettings;
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
