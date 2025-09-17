from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
import uuid, os, json

app = FastAPI(title='USM Backend')

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

STORAGE = os.path.join(os.path.dirname(__file__), 'storage')
SAMPLES = os.path.join(STORAGE, 'samples')
PROJECTS = os.path.join(STORAGE, 'projects')
os.makedirs(SAMPLES, exist_ok=True)
os.makedirs(PROJECTS, exist_ok=True)

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

@app.post('/samples/upload')
async def upload_sample(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1] or '.bin'
    sid = str(uuid.uuid4()) + ext
    path = os.path.join(SAMPLES, sid)
    with open(path, 'wb') as f:
        f.write(await file.read())
    return {'id': sid, 'url': f'/samples/{sid}', 'name': file.filename}

@app.get('/samples/list')
def list_samples():
    return [{'id': f, 'url': f'/samples/{f}'} for f in os.listdir(SAMPLES)]

@app.post('/projects/save')
async def save_project(p: Project):
    pid = p.id or str(uuid.uuid4())
    with open(os.path.join(PROJECTS, pid + '.json'), 'w', encoding='utf-8') as f:
        f.write(p.json())
    return {'id': pid}

@app.get('/projects/{pid}')
def load_project(pid: str):
    path = os.path.join(PROJECTS, pid + '.json')
    if not os.path.exists(path):
        return {'error': 'not found'}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)
