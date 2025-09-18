import io
import math
import os
import wave
from array import array
from importlib import reload

import pytest
from starlette.requests import Request


def _make_test_tone(duration: float = 0.1, sample_rate: int = 44100, freq: float = 220.0):
    total_samples = int(duration * sample_rate)
    tone = array(
        'h',
        [
            int(0.6 * 32767 * math.sin(2 * math.pi * freq * n / sample_rate))
            for n in range(total_samples)
        ],
    )
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(tone.tobytes())
    buffer.seek(0)
    return buffer, total_samples, sample_rate


def _segment_has_audio(data: array, start: int, length: int) -> bool:
    segment = data[start : start + length]
    return any(abs(sample) > 0 for sample in segment)


def _make_request(filename: str) -> Request:
    async def receive():
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    headers = [(b'x-filename', filename.encode())]
    scope = {
        'type': 'http',
        'http_version': '1.1',
        'method': 'POST',
        'path': '/samples/upload',
        'raw_path': b'/samples/upload',
        'query_string': b'',
        'headers': headers,
        'client': ('testclient', 123),
        'server': ('testserver', 80),
    }
    return Request(scope, receive)


@pytest.fixture()
def backend_app(tmp_path, monkeypatch):
    storage_dir = tmp_path / 'storage'
    monkeypatch.setenv('USM_STORAGE_DIR', str(storage_dir))
    import backend.main as main_module

    main = reload(main_module)
    return main


@pytest.fixture()
def anyio_backend():
    return 'asyncio'


@pytest.mark.anyio()
async def test_upload_loop_and_export(backend_app):
    main = backend_app
    sample_buffer, sample_frames, sample_rate = _make_test_tone()

    request = _make_request('test-tone.wav')
    upload_result = await main.upload_sample(request, payload=sample_buffer.getvalue())
    sample_id = upload_result['id']

    project_payload = {
        'id': '',
        'name': 'Loop Export Test',
        'pads': [
            {
                'id': 'pad-0',
                'name': 'Pad 1',
                'color': '#ffffff',
                'gain': 1.0,
                'attack': 0.0,
                'decay': 0.1,
                'startOffset': 0.0,
                'loop': False,
                'muted': False,
                'sample': {
                    'id': sample_id,
                    'name': 'test-tone.wav',
                    'duration': sample_frames / sample_rate,
                    'sampleRate': sample_rate,
                },
            }
        ],
        'pattern': {
            'steps': {0: ['pad-0'], 8: ['pad-0']},
            'length': 16,
        },
        'transport': {
            'playing': False,
            'bpm': 120,
            'stepsPerBar': 16,
            'bars': 1,
            'swing': 0,
        },
    }

    project_model = main.Project(**project_payload)
    save_result = await main.save_project(project_model)
    project_id = save_result['id']

    cycles = 2
    export_response = main.export_project(project_id, cycles=cycles)
    assert export_response.media_type == 'audio/wav'
    export_path = export_response.path
    assert os.path.exists(export_path)

    with wave.open(export_path, 'rb') as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getsampwidth() == 2
        assert wav_file.getframerate() == sample_rate
        frame_count = wav_file.getnframes()
        frames = wav_file.readframes(frame_count)

    audio_data = array('h')
    audio_data.frombytes(frames)

    beats_per_sec = project_payload['transport']['bpm'] / 60.0
    step_factor = project_payload['transport']['stepsPerBar'] / 4.0
    step_samples = round((1.0 / (beats_per_sec * step_factor)) * sample_rate)
    expected_frames = step_samples * project_payload['pattern']['length'] * cycles
    assert frame_count == expected_frames
    assert max(abs(sample) for sample in audio_data) > 0

    first_start = 0
    second_start = step_samples * 8
    third_start = step_samples * 16
    fourth_start = step_samples * 24
    assert _segment_has_audio(audio_data, first_start, sample_frames)
    assert _segment_has_audio(audio_data, second_start, sample_frames)
    assert _segment_has_audio(audio_data, third_start, sample_frames)
    assert _segment_has_audio(audio_data, fourth_start, sample_frames)

    exports = os.listdir(main.EXPORTS)
    assert exports, 'an exported wav file should be written to disk'
