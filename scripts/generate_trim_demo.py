#!/usr/bin/env python3
"""Generate a short sine-wave clip for trimming demos without bundling binaries.

The script writes a mono WAV file to the requested path (defaults to
`frontend/public/trim-demo.wav`).
"""
from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

def render_sine(
    *,
    output: Path,
    duration_seconds: float = 2.0,
    frequency_hz: float = 440.0,
    sample_rate: int = 48_000,
    amplitude: float = 0.35,
) -> None:
    """Render a normalized sine tone to ``output``.

    Args:
        output: Destination path for the rendered WAV file.
        duration_seconds: Clip length in seconds.
        frequency_hz: Frequency of the generated sine tone.
        sample_rate: Output sample rate in Hz.
        amplitude: Peak amplitude (0.0-1.0) of the sine wave.
    """
    frame_count = int(duration_seconds * sample_rate)
    with wave.open(str(output), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit PCM
        wav_file.setframerate(sample_rate)

        for i in range(frame_count):
            theta = 2.0 * math.pi * frequency_hz * (i / sample_rate)
            sample = math.sin(theta) * amplitude
            # Clamp and convert to signed 16-bit integer
            clamped = max(-1.0, min(1.0, sample))
            int_sample = int(clamped * 32767.0)
            wav_file.writeframesraw(int_sample.to_bytes(2, byteorder="little", signed=True))

        wav_file.writeframes(b"")

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output",
        nargs="?",
        default="frontend/public/trim-demo.wav",
        help="Path to write the generated WAV file (default: %(default)s)",
    )
    parser.add_argument("--duration", type=float, default=2.0, help="Clip length in seconds (default: %(default)s)")
    parser.add_argument("--frequency", type=float, default=440.0, help="Sine frequency in Hz (default: %(default)s)")
    parser.add_argument("--sample-rate", type=int, default=48_000, help="Sample rate in Hz (default: %(default)s)")
    parser.add_argument(
        "--amplitude",
        type=float,
        default=0.35,
        help="Peak amplitude from 0.0-1.0 (default: %(default)s)",
    )
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    render_sine(
        output=output_path,
        duration_seconds=args.duration,
        frequency_hz=args.frequency,
        sample_rate=args.sample_rate,
        amplitude=args.amplitude,
    )
    print(f"Wrote sine wave to {output_path}")

if __name__ == "__main__":
    main()
