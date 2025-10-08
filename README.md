# Untitled Sampler Machine (USM)

A minimal, extensible scaffold for a browser‑based drum/sampler workstation. The
project ships with a working React client, a FastAPI backend, and a small set of
shared types so you can focus on extending sampler behaviour instead of wiring
up basics from scratch.

The default experience now boots straight into an **808 starter groove**: four
pads are preloaded with kick, snare, clap and closed hi-hat voices that are
procedurally synthesized on startup, plus a 16-step pattern so you can hit play
and hear a beat immediately.

## Core Functionality

### Pad grid and sample management
- Eight velocity‑agnostic pads are provided out of the box (see
  `frontend/src/components/PadGrid.tsx`).
- The first four pads are preconfigured as Kick, Snare, Clap and Hi‑Hat and are
  populated from an in-memory 808-inspired kit rendered by the demo loader
  (`frontend/src/components/DemoProjectLoader.tsx`).
- Each pad exposes gain, attack, decay, start offset, looping and mute controls
  through the global Zustand store, making it easy to tweak per‑tile playback
  characteristics.
- Users can drop an audio file onto a pad or load from the file picker. Files
  are decoded in the browser (`decodeArrayBuffer`) and cached per pad for
  immediate triggering (`playBuffer`).
- Double‑clicking a pad will fire the loaded buffer immediately so you can audition
  edits without starting the transport.

### Transport, scheduler and sequencing
- The global transport bar manages play/stop, BPM and loop length controls; it
  drives a look‑ahead scheduler that keeps the sequencer sample accurate even if
  the UI stutters (`frontend/src/audio/Scheduler.ts`).
- A sequencer grid lets you toggle steps per pad. The highlighted step cursor
  follows the current quantized position so you always know where you are in the
  loop.
- The demo project ships with a one-bar, 16-step pattern that outlines a classic
  808 groove—kick on the ones and threes, snare on the twos and fours, hi-hats
  on every step, and a clap accent on beat three.
- Pattern length automatically expands or contracts when the number of bars
  changes, and the store exposes helpers (`setBars`, `toggleStep`) for future UI
  enhancements.

### Recording straight into pads
- The sample recorder component (`SampleRecorder.tsx`) captures microphone input
  with the MediaRecorder API and assigns the result to the currently selected pad.
- Recordings are stored client‑side by default, but the wiring is ready for you
  to post the blob to the backend for persistence or conversion.

### Backend project and sample lifecycle
- `/samples/upload` accepts either multipart uploads or raw payloads with an
  `x-filename` header, saves the file under `backend/storage/samples`, and returns
  an ID + URL that the frontend can stash.
- `/samples/list` exposes saved samples; `/projects/save` and `/projects/{pid}`
  persist and retrieve project JSON payloads respectively, enabling lightweight
  session storage.
- `/projects/{pid}/export` renders the stored pattern into a WAV loop by mixing
  pad buffers according to BPM, pattern length and per‑pad gain/offset settings.
  The export is written to `backend/storage/exports` and streamed back as a file
  download.

## Tech
- **Frontend**: React + Vite + TypeScript, Web Audio API (AudioWorklets optional stub).
- **State**: Zustand.
- **Backend**: FastAPI (Python) for sample upload, project save/load.
- **Shared**: Type definitions consumed by the frontend.

## Project Structure
```
untitled-sampler-machine/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── store.ts
│       ├── audio/
│       └── components/
├── backend/
│   ├── main.py
│   └── pyproject.toml
└── shared/
    └── types.ts
```

## Quickstart
### Frontend
```bash
cd frontend
npm install
npm run dev
```

Once the dev server is running, visit the printed URL. You should see the pad
grid with the four preloaded 808 sounds. Click **Play** in the transport to hear
the starter beat, then tweak steps, swap samples or record your own material.

### Backend
```bash
cd backend
uvicorn main:app --reload
```

Static sample storage is created automatically at `backend/storage`.

## Using the preloaded 808 demo

1. Start the frontend as described above and open it in your browser.
2. Hit **Play** in the transport bar to audition the 100 BPM demo loop.
3. Toggle steps in the sequencer to rework the groove. The pattern length is set
   to a single bar, but you can add more using the **Bars** control.
4. Swap any pad's sample by clicking **Drop/Load** and selecting an audio file.
   The loader will replace the synthesized sample while keeping the pattern
   intact.
5. Double-click a pad tile to trigger it instantly without starting playback.

The demo assets are small synthetic 808-inspired one-shots generated entirely in
the browser on first render. They are lightweight enough for rapid prototyping,
but feel free to replace them with your own recordings.

## Testing

Both the backend and frontend ship with focused tests that exercise their core
behaviour.

### Backend (pytest)
- The suite lives in `backend/tests`. The `test_loop_export.py` test spins up the
  FastAPI app with an isolated storage directory, uploads a generated sine wave,
  saves a miniature project and asserts that exporting multiple loop cycles writes
  a correctly‑sized mono WAV file. This gives you confidence that uploads,
  persistence and offline rendering work together.
- Run the tests from the repository root or the `backend/` directory:

  ```bash
  cd backend
  pytest
  ```

### Frontend (Vitest + Testing Library)
- Component tests live alongside their sources. For example,
  `frontend/src/components/Transport.test.tsx` verifies that the transport bar
  renders correctly, toggles play/stop state and reacts to BPM slider changes.
- Install dependencies if you have not already, then run:

  ```bash
  cd frontend
  npm test
  ```

## High‑level Architecture
- `frontend/src/audio/Engine` — single AudioContext, graph factory, tempo/clock.
- `frontend/src/audio/Scheduler` — look‑ahead scheduler (25ms default), schedules steps at sample‑accurate times.
- `frontend/src/audio/SamplePlayer` — per‑tile buffer player with ADSR‑like envelope.
- `frontend/src/store` — global app state (pads, patterns, transport).
- `frontend/src/components/Sequencer` — UI for steps; extend/shrink pattern length.
- `frontend/src/components/SampleRecorder` — microphone record -> WAV -> assign to selected pad.
- Backend offers `/samples` (upload/list) and `/projects` (save/load).

## Notes
- This is scaffolding; not production hardened. Replace stubs and expand to taste.
- Worklet processor is stubbed; you can migrate envelopes to an AudioWorklet if needed.
