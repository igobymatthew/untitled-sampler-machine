# Untitled Sampler Machine (USM)

A minimal, extensible scaffold for a browser‑based drum/sampler workstation with:
- Per‑tile sample control (gain, start offset, attack/decay, one‑shot/loop).
- Global transport: tempo, start/stop, loop length, quantized scheduling.
- Pattern sequencer with extend/shrink loops.
- Record directly into a tile (via microphone) and auto‑assign.
- Project/save API scaffolding.

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

### Backend
```bash
cd backend
uvicorn main:app --reload
```

Static sample storage is created automatically at `backend/storage`.

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
