# Trim Demo Clip Workflow

This guide walks through generating the bundled trim-demo audio clip and loading it into the sampler UI for verifying waveform trimming.

## 1. Generate the sine-wave clip
Run the helper script from the repository root:

```bash
python scripts/generate_trim_demo.py
```

The script renders a short sine wave directly to `frontend/public/trim-demo.wav`.

### Custom output path
Optionally specify a different path:

```bash
python scripts/generate_trim_demo.py path/to/custom.wav
```

See `python scripts/generate_trim_demo.py --help` for amplitude, duration, and sample-rate overrides.

## 2. Launch the frontend
Start the development server so you can interact with the pads:

```bash
cd frontend
npm install
npm run dev
```

## 3. Load the clip into a pad
1. Open the sampler UI in your browser (default: http://localhost:5173).
2. Choose an empty pad.
3. Use the pad's upload button to select `trim-demo.wav` (or your custom file).
4. Wait for the waveform to render.

## 4. Open the trim window
1. With the pad selected, click the waveform editor or trim icon.
2. Confirm that the waveform editing trim modal appears with the generated clip.
3. Verify that the trim range shows the full two-second clip (start at `0.00s`, end at `2.00s`) and the waveform preview renders with start/end guides.

Use this workflow for manual verification or to drive automated UI demos that depend on a predictable audio asset.
