from fastapi import FastAPI, UploadFile, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uuid, os, json, wave
from array import array


STORAGE = os.environ.get('USM_STORAGE_DIR') or os.path.join(os.path.dirname(__file__), 'storage')
SAMPLES = os.path.join(STORAGE, 'samples')
PROJECTS = os.path.join(STORAGE, 'projects')
EXPORTS = os.path.join(STORAGE, 'exports')
os.makedirs(SAMPLES, exist_ok=True)
os.makedirs(PROJECTS, exist_ok=True)
os.makedirs(EXPORTS, exist_ok=True)

app = FastAPI(title='USM Backend')

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.mount('/samples', StaticFiles(directory=SAMPLES), name='samples')

class Project(BaseModel):
    id: str
    name: str
    pads: list
    pattern: dict
    transport: dict

@app.get('/health')
def health():
    return {'ok': True}

async def _process_upload(request: Request, file: UploadFile | None, payload: bytes | None):
    if file is not None:
        contents = await file.read()
        original_name = file.filename or 'upload.bin'
    else:
        body = payload if payload is not None else await request.body()
        if not body:
            raise HTTPException(status_code=400, detail='No file provided')
        contents = body
        original_name = request.headers.get('x-filename', 'upload.bin')

    ext = os.path.splitext(original_name)[1] or '.bin'
    sid = str(uuid.uuid4()) + ext
    path = os.path.join(SAMPLES, sid)
    with open(path, 'wb') as f:
        f.write(contents)
    return {'id': sid, 'url': f'/samples/{sid}', 'name': original_name}


try:
    import multipart  # type: ignore # noqa: F401
    HAS_MULTIPART = True
except ImportError:
    try:
        import python_multipart  # type: ignore # noqa: F401
        HAS_MULTIPART = True
    except ImportError:
        HAS_MULTIPART = False


if HAS_MULTIPART:
    from fastapi import File

    @app.post('/samples/upload')
    async def upload_sample(
        request: Request,
        file: UploadFile | None = File(None),
        payload: bytes | None = Body(default=None),
    ):
        return await _process_upload(request, file, payload)
else:

    @app.post('/samples/upload')
    async def upload_sample(request: Request, payload: bytes | None = Body(default=None)):
        return await _process_upload(request, None, payload)

@app.get('/samples/list')
def list_samples():
    return [{'id': f, 'url': f'/samples/{f}'} for f in os.listdir(SAMPLES)]

@app.post('/projects/save')
async def save_project(p: Project):
    pid = p.id or str(uuid.uuid4())
    with open(os.path.join(PROJECTS, pid + '.json'), 'w', encoding='utf-8') as f:
        f.write(p.model_dump_json())
    return {'id': pid}

@app.get('/projects/{pid}')
def load_project(pid: str):
    path = os.path.join(PROJECTS, pid + '.json')
    if not os.path.exists(path):
        return {'error': 'not found'}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _load_wav_sample(path: str):
    with wave.open(path, 'rb') as wav_file:
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        if channels != 1:
            raise ValueError('Only mono WAV samples are supported')
        if sample_width != 2:
            raise ValueError('Only 16-bit PCM WAV samples are supported')
        sample_rate = wav_file.getframerate()
        frames = wav_file.readframes(wav_file.getnframes())
    data = array('h')
    data.frombytes(frames)
    return sample_rate, data


def render_loop_to_wav(project: dict, pid: str, cycles: int) -> str:
    if cycles < 1:
        raise ValueError('cycles must be at least 1')

    transport = project.get('transport') or {}
    bpm = float(transport.get('bpm', 120) or 120)
    steps_per_bar = int(transport.get('stepsPerBar', 16) or 16)
    if bpm <= 0:
        raise ValueError('BPM must be positive')
    if steps_per_bar <= 0:
        raise ValueError('stepsPerBar must be positive')

    pattern = project.get('pattern') or {}
    pattern_length = int(pattern.get('length') or steps_per_bar)
    if pattern_length <= 0:
        raise ValueError('pattern length must be positive')

    pads = {pad.get('id'): pad for pad in project.get('pads', []) if pad.get('id')}
    step_map = {}
    for key, pad_ids in (pattern.get('steps') or {}).items():
        try:
            idx = int(key)
        except (TypeError, ValueError):
            continue
        step_map[idx] = list(pad_ids or [])

    sample_cache = {}
    sample_rate = None
    for pad_id, pad in pads.items():
        if pad.get('muted'):
            continue
        sample_meta = pad.get('sample')
        if not sample_meta:
            continue
        sample_id = sample_meta.get('id')
        if not sample_id:
            continue
        sample_path = os.path.join(SAMPLES, sample_id)
        if not os.path.exists(sample_path):
            raise ValueError(f'sample {sample_id} not found for pad {pad_id}')
        rate, data = _load_wav_sample(sample_path)
        if sample_rate is None:
            sample_rate = rate
        elif sample_rate != rate:
            raise ValueError('all samples must share the same sample rate')
        start_offset = max(0.0, float(pad.get('startOffset', 0.0) or 0.0))
        offset_samples = int(round(start_offset * sample_rate))
        if offset_samples >= len(data):
            continue
        trimmed = data[offset_samples:]
        if not trimmed:
            continue
        gain = float(pad.get('gain', 1.0) or 0.0)
        gain = max(0.0, min(gain, 1.0))
        sample_cache[pad_id] = {'data': trimmed, 'gain': gain}

    if not sample_cache:
        raise ValueError('no samples available to export')

    beats_per_sec = bpm / 60.0
    step_factor = steps_per_bar / 4.0
    if step_factor <= 0:
        raise ValueError('stepsPerBar must be positive')
    step_duration_sec = 1.0 / (beats_per_sec * step_factor)
    step_samples = max(1, round(step_duration_sec * sample_rate))
    total_steps = pattern_length * cycles
    if total_steps <= 0:
        raise ValueError('no steps to render')

    mix_buffer = [0.0] * (step_samples * total_steps)

    for cycle in range(cycles):
        for step_index in range(pattern_length):
            pad_ids = step_map.get(step_index, [])
            if not pad_ids:
                continue
            start_pos = (cycle * pattern_length + step_index) * step_samples
            for pad_id in pad_ids:
                sample_info = sample_cache.get(pad_id)
                if not sample_info:
                    continue
                data = sample_info['data']
                gain = sample_info['gain']
                end_pos = start_pos + len(data)
                if end_pos > len(mix_buffer):
                    mix_buffer.extend([0.0] * (end_pos - len(mix_buffer)))
                for i, sample_val in enumerate(data):
                    idx = start_pos + i
                    if idx >= len(mix_buffer):
                        break
                    mix_buffer[idx] += (sample_val / 32768.0) * gain

    output = array('h', [0] * len(mix_buffer))
    for i, val in enumerate(mix_buffer):
        if val > 1.0:
            val = 1.0
        elif val < -1.0:
            val = -1.0
        output[i] = int(round(val * 32767))

    filename = f"{pid or 'project'}-loop-{cycles}x-{uuid.uuid4().hex}.wav"
    out_path = os.path.join(EXPORTS, filename)
    with wave.open(out_path, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(output.tobytes())

    return out_path


@app.get('/projects/{pid}/export')
def export_project(pid: str, cycles: int = 1):
    path = os.path.join(PROJECTS, pid + '.json')
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail='project not found')
    with open(path, 'r', encoding='utf-8') as f:
        project = json.load(f)
    try:
        export_path = render_loop_to_wav(project, pid, cycles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    filename = os.path.basename(export_path)
    return FileResponse(export_path, media_type='audio/wav', filename=filename)
