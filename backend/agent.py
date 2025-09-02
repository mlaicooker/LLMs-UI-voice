import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

from fastapi import Query
from datetime import datetime
import torch
import librosa
import json
import uvicorn
import threading
import time
from transformers import WhisperProcessor, WhisperForConditionalGeneration
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import uuid
import subprocess
import aiosqlite
import ollama
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
import base64
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io
from pydub import AudioSegment
from fastapi.responses import StreamingResponse, FileResponse
import httpx

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)
LOCAL_JSON_DATASET = None
DRIFT_LOG = []
DRIFT_LOG_LOCK = threading.Lock()
DB_PATH = "db/conversations.db"

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

class STTModule:
    def __init__(self, model_path="model/whisper", sample_rate=16000):
        self.processor = WhisperProcessor.from_pretrained(model_path)
        self.model = WhisperForConditionalGeneration.from_pretrained(model_path)
        self.sample_rate = sample_rate

    def transcribe(self, audio_path):
        audio, sr = librosa.load(audio_path, sr=self.sample_rate, mono=True)
        waveform = torch.tensor(audio).unsqueeze(0)
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        input_features = self.processor(
            waveform.squeeze().numpy(), sampling_rate=self.sample_rate, return_tensors="pt"
        ).input_features
        predicted_ids = self.model.generate(input_features)
        transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        return transcription

class MemoryModule:
    def __init__(self, embedding_model_name="intfloat/multilingual-e5-large", db_path="./chromadb_data"):
        self.embedding_model = SentenceTransformer(embedding_model_name)
        self.client = chromadb.PersistentClient(path=db_path, settings=Settings(anonymized_telemetry=False))
        self.collection = self.client.get_or_create_collection(name="memory")
        if not self.collection.count():
            text = "You are AI chatbot agent for me. You have to help me with questions about several areas."
            embedding = self.embedding_model.encode(text).tolist()
            self.collection.add(documents=[text], embeddings=[embedding], ids=["return_policy_1"])

    def add_memory(self, text):
        embedding = self.embedding_model.encode(text).tolist()
        self.collection.add(documents=[text], embeddings=[embedding], ids=[str(uuid.uuid4())])

    def retrieve(self, query, n_results=3):
        query_embedding = self.embedding_model.encode(query).tolist()
        results = self.collection.query(query_embeddings=[query_embedding], n_results=n_results)
        return results['documents'][0]

class LLMModule:
    def __init__(self, model_name="llama3"):
        self.model_name = model_name

    def query(self, prompt, max_words=500):
        # Add instruction to prompt to control length
        prompt = f"{prompt}\n\nPlease answer in no more than {max_words} words."
        result = subprocess.run(
            ['ollama', 'run', self.model_name],
            input=prompt.encode(),
            capture_output=True
        )
        return result.stdout.decode().strip()

class RagWithFilesRequest(BaseModel):
    query: str
    file_ids: List[str]

class QueryRequest(BaseModel):
    query: str

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stt = STTModule(model_path="model/whisper")
memory = MemoryModule()
llm = LLMModule()
manager = ConnectionManager()

@app.websocket("/ws/record")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    session_id = str(uuid.uuid4())
    chunk_count = 0

    ebml_header = None

    try:
        while True:
            data = await websocket.receive_text()
            if chunk_count == 0 and ebml_header is None:
                ebml_header = data
                chunk_filename = f"chunks_webm/{session_id}_chunk_{chunk_count}.webm"
                with open(chunk_filename, "wb") as f:
                    f.write(data)
            else:
                # Prepend EBML header to subsequent chunks
                combined_data = ebml_header + data
                chunk_filename = f"chunks_webm/{session_id}_chunk_{chunk_count}.webm"
                with open(chunk_filename, "wb") as f:
                    f.write(combined_data)

            print(f"Saved chunk: {chunk_filename}")
            chunk_count += 1

            # Convert to WAV
            wav_filename = chunk_filename.replace(".webm", ".wav")
            subprocess.run([
                "ffmpeg",
                "-i", chunk_filename,
                "-ar", "44100",
                "-ac", "1",
                "-acodec", "pcm_s16le",
                wav_filename
            ])
            print(f"Converted to: {wav_filename}")
            
            if chunk_count:
            # Remove first 3000ms from wav file
                audio = AudioSegment.from_wav(wav_filename)
                trimmed = audio[2900:]  # Remove first 3000 ms
                trimmed.export(wav_filename, format="wav")

            transcription = stt.transcribe(wav_filename)
            print(transcription)
            await manager.send_message(transcription, websocket)
            os.remove(wav_filename)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        
@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...), type: str = Form(None)):
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[-1]
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    with open(file_path, "wb") as f:
        f.write(await file.read())
    return {"file_id": file_id, "file_path": file_path}

async def generate_tts_audio(text):
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "http://localhost:8001/tts",
                json={"text": text}
            )
            data = resp.json()
            if "error" in data:
                return None, data["error"]
            return data["audio_url"], None
    except httpx.ReadTimeout:
        return None, "TTS service timed out"
    except Exception as e:
        return None, f"TTS service error: {str(e)}"

@app.post("/rag")
async def rag_endpoint(request: QueryRequest):
    query = request.query
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Save user query
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "user",
                query,
            )
        )
        await db.commit()

    context_docs = memory.retrieve(query)
    context = "\n".join(context_docs)
    prompt = f"[User Question]: {query} [Relevant Info]: {context} [Answer]:"
    # Control response length by passing max_words
    response = llm.query(prompt, max_words=500)
    memory.add_memory(query)

    async with aiosqlite.connect(DB_PATH) as db:
        # Save assistant response
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "assistant",
                response.strip(),
            )
        )
        await db.commit()

    # Generate TTS audio for the response
    audio_url, error = await generate_tts_audio(response.strip())
    if error:
        return {"error": "TTS generation failed"}
    return {"response": response.strip(), "audio_url": audio_url}

@app.post("/stt-rag")
async def stt_rag_endpoint(file: UploadFile = File(...)):
    temp_path = f"temp_{uuid.uuid4()}.wav"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    query = stt.transcribe(temp_path)
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Save user query
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "user",
                query,
            )
        )
        await db.commit()

    context_docs = memory.retrieve(query)
    context = "\n".join(context_docs)
    prompt = f"[User Question]: {query} [Relevant Info]: {context} [Answer]:"
    response = llm.query(prompt, max_words=500)
    memory.add_memory(query)

    async with aiosqlite.connect(DB_PATH) as db:
        # Save assistant response
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "assistant",
                response.strip(),
            )
        )
        await db.commit()

    # Generate TTS audio for the response
    audio_url, error = await generate_tts_audio(response.strip())
    if error:
        return {"error": "TTS generation failed"}
    return {"response": response.strip(), "audio_url": audio_url}

@app.post("/rag-with-files")
async def rag_with_files_endpoint(request: RagWithFilesRequest):
    image_paths = []
    for file_id in request.file_ids:
        for fname in os.listdir(UPLOAD_DIR):
            if fname.startswith(file_id):
                image_paths.append(os.path.join(UPLOAD_DIR, fname))
                break

    # Validate images before sending to Ollama
    from PIL import Image
    valid_image_paths = []
    for img_path in image_paths:
        try:
            with Image.open(img_path) as img:
                img.verify()
            valid_image_paths.append(img_path)
        except Exception as e:
            print(f"Skipping invalid image {img_path}: {e}")

    # Use ollama.chat synchronously (do not await)
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Save user query
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "user",
                request.query,
            )
        )
        await db.commit()

    # For image-based LLM, add instruction to user query
    request.query = f"{request.query}\n\nPlease answer in no more than 500 words."
    response = ollama.chat(
        model='llava',
        messages=[{
            'role': 'user',
            'content': request.query,
            'images': valid_image_paths
        }]
    )
    response_text = getattr(response, "message", None)
    if response_text and hasattr(response_text, "content"):
        response_text = response.message.content.strip()
    else:
        response_text = str(response).strip()

    async with aiosqlite.connect(DB_PATH) as db:
        # Save assistant response
        await db.execute(
            "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "assistant",
                response_text,
            )
        )
        await db.commit()

    # Generate TTS audio for the response
    audio_url, error = await generate_tts_audio(response_text)
    if error:
        return {"error": "TTS generation failed"}
    return {"response": response_text, "audio_url": audio_url}


@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    file_path = os.path.join("tts_outputs", filename)
    return FileResponse(file_path, media_type="audio/wav")

def add_drift_log(entry):
    with DRIFT_LOG_LOCK:
        DRIFT_LOG.append(entry)
        if len(DRIFT_LOG) > 100:
            DRIFT_LOG[:] = DRIFT_LOG[-100:]

def export_drift_log():
    with DRIFT_LOG_LOCK:
        return {
            "export_timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "total_entries": len(DRIFT_LOG),
            "entries": DRIFT_LOG,
        }

def drift_log_auto_export():
    while True:
        time.sleep(15 * 60)
        export_drift_log()

threading.Thread(target=drift_log_auto_export, daemon=True).start()

async def heartbeat_check_db():
    db_exists = os.path.exists(DB_PATH)
    has_data = False
    if db_exists:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM conversations")
            row = await cursor.fetchone()
            has_data = row[0] > 0
    status = {
        "db_exists": db_exists,
        "json_loader": has_data,
        "execution_mode": True,
        "compliance_tone": True,
    }
    if not status["json_loader"]:
        add_drift_log({
            "id": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "type": "compliance_drift",
            "message": "Conversation DB empty or missing, auto-repair triggered.",
            "severity": "high",
        })
    return status

@app.post("/agent/initialize")
async def agent_initialize(payload: dict):
    heartbeat = await heartbeat_check_db()
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "execution_mode",
        "message": "Agent initialized in execution mode v0.",
        "severity": "low",
    })
    return {
        "status": "initialized",
        "heartbeat": heartbeat,
        "drift_log": export_drift_log(),
    }

@app.get("/agent/heartbeat")
async def agent_heartbeat():
    heartbeat = await heartbeat_check_db()
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "heartbeat",
        "message": f"Heartbeat check: {heartbeat}",
        "severity": "low",
    })
    return {"heartbeat": heartbeat}

async def init_db():
    os.makedirs("db", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                role TEXT,
                content TEXT
            )
        """)
        await db.commit()

@app.get("/system/status")
async def system_status():
    return {"status": "ok"}

@app.on_event("startup")
async def startup_event():
    await init_db()

loaded, total = 0, 0

@app.post("/load-conversations-progress")
async def load_conversations_progress(file: UploadFile = File(...)):
    global loaded, total
    percent = (loaded / total) * 100 if total else 100
    return {
        "loaded": loaded,
        "total": total,
        "percent": percent,
        "status": percent == 100 and "done" or "in progress"
    }

@app.get("/agent/static_recall")
async def agent_static_recall():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT id, timestamp, role, content FROM conversations ORDER BY timestamp DESC LIMIT 3")
        rows = await cursor.fetchall()
        result = [{"id": r[0], "timestamp":r[1], "role": r[2], "content": r[3]} for r in rows]
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "compliance_drift",
        "message": "Static recall check performed.",
        "severity": "low",
    })
    return {"status": "success", "result": result}

@app.get("/agent/timestamp_check")
async def agent_timestamp_check():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT timestamp FROM conversations ORDER BY timestamp DESC LIMIT 1")
        row = await cursor.fetchone()
        timestamp = row[0] if row else None
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "compliance_drift",
        "message": "Timestamp check performed.",
        "severity": "low",
    })
    return {"status": "success", "timestamp": timestamp}

@app.get("/agent/key_echo")
async def agent_key_echo():
    top_level_keys = ["id", "timestamp", "role", "content"]
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "compliance_drift",
        "message": "Key echo test performed.",
        "severity": "low",
    })
    return {"status": "success", "top_level_keys": top_level_keys, "entry_keys": top_level_keys}

@app.get("/agent/history")
async def agent_history():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id, timestamp, role, content FROM conversations ORDER BY timestamp DESC LIMIT 100"
        )
        rows = await cursor.fetchall()
        result = [
            {"id": r[0], "timestamp": r[1], "role": r[2], "content": r[3]}
            for r in rows
        ]
    add_drift_log({
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "type": "compliance_drift",
        "message": "History recall (100) performed.",
        "severity": "low",
    })
    return {"status": "success", "history": result}

@app.post("/load-conversations")
async def load_conversations_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        data = json.loads(contents.decode("utf-8"))
        global loaded, total
        total = 0
        loaded = 0
        print("Counting total messages to load...")
        for conv in data:
            if "mapping" in conv:
                for message_id, message_data in conv["mapping"].items():
                    if message_data.get("message") and message_data["message"].get("content"):
                        content_parts = message_data["message"]["content"].get("parts", [])
                        total += sum(1 for part in content_parts if isinstance(part, str) and part.strip())
        print(total)
        async with aiosqlite.connect(DB_PATH) as db:
            print("Loading conversations...")
            for conv in data:
                if "mapping" in conv:
                    for message_id, message_data in conv["mapping"].items():
                        if message_data.get("message") and message_data["message"].get("content") and message_data["message"]["content"].get("content_type") == "text":
                            content_parts = message_data["message"]["content"].get("parts")
                            for part in content_parts:
                                if isinstance(part, str) and part.strip():
                                    memory.add_memory(part.strip())
                                    loaded += 1
                                    unix_timestamp = message_data["message"].get("create_time")
                                    iso_timestamp = datetime.utcfromtimestamp(unix_timestamp).strftime("%Y-%m-%d %H:%M:%S")
                                    await db.execute(
                                        "INSERT OR REPLACE INTO conversations (id, timestamp, role, content) VALUES (?, ?, ?, ?)",
                                        (
                                            message_data["message"].get("id"),
                                            iso_timestamp,
                                            message_data["message"]["author"].get("role"),
                                            part.strip(),
                                        )
                                    )
                                    await db.commit()
        add_drift_log({
            "id": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "type": "json_loader",
            "message": f"Conversation JSON saved ({total} entries).",
            "severity": "low",
        })
        return {"status": "success", "total_entries": total}
    except Exception as e:
        add_drift_log({
            "id": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "type": "json_error",
            "message": f"Failed to save JSON: {e}",
            "severity": "high",
        })
        return {"status": "error", "error": str(e)}

@app.get("/chat-history/messages")
async def get_chat_history(
    before: str = Query(None),
    limit: int = Query(20)
):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM conversations")
        total_count = (await cursor.fetchone())[0]

        before_timestamp = None
        if before:
            cursor = await db.execute("SELECT timestamp FROM conversations WHERE id = ?", (before,))
            row = await cursor.fetchone()
            before_timestamp = row[0] if row else None

        if before_timestamp:
            cursor = await db.execute(
                "SELECT id, role, content, timestamp FROM conversations WHERE timestamp < ? ORDER BY timestamp DESC LIMIT ?",
                (before_timestamp, limit)
            )
        else:
            cursor = await db.execute(
                "SELECT id, role, content, timestamp FROM conversations ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
        rows = await cursor.fetchall()

        messages = []
        for r in rows:
            msg_type = "assistant" if r[1] == "assistant" else "user"
            messages.append({
                "id": r[0],
                "type": msg_type,
                "content": r[2],
                "timestamp": r[3],
                "is_voice": False,
                "category": None,
                "symbol_path": None,
                "confidence": None
            })

        has_more = False
        if rows:
            last_timestamp = rows[-1][3]
            cursor = await db.execute(
                "SELECT COUNT(*) FROM conversations WHERE timestamp < ?", (last_timestamp,)
            )
            count = (await cursor.fetchone())[0]
            has_more = count > 0

    return {
        "messages": list(reversed(messages)),
        "has_more": has_more,
        "total_count": total_count
    }

# Example usage to delete first 2 seconds from a wav file:
def remove_first_2_seconds(wav_path, output_path):
    audio = AudioSegment.from_wav(wav_path)
    trimmed = audio[2000:]  # Remove first 2000 ms (2 seconds)
    trimmed.export(output_path, format="wav")

# Usage in your code, for example after exporting a wav:
# temp_path = "temp_valid.wav"
# remove_first_2_seconds(temp_path, "temp_valid_trimmed.wav")
# ...then use "temp_valid_trimmed.wav" for transcription...

if __name__ == "__main__":
    uvicorn.run("agent:app", host="0.0.0.0", port=8080, reload=True)