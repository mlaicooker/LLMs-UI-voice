import os
import uuid
import subprocess
import sys
from fastapi import FastAPI, Body
from pydantic import BaseModel
from pydub import AudioSegment

app = FastAPI()

class TTSRequest(BaseModel):
    text: str

def split_text(text, max_length=350):
    # Split by double newlines (paragraphs), then by lines if needed
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + (2 if current else 0) <= max_length:
            # +2 for the '\n\n' separator if not the first paragraph
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    return chunks

@app.post("/tts")
async def tts_endpoint(req: TTSRequest):
    tts_wav_path = "tts_outputs"
    os.makedirs(tts_wav_path, exist_ok=True)
    python_executable = sys.executable

    # Split text if too long
    text_chunks = split_text(req.text, max_length=350)
    audio_segments = []
    for idx, chunk in enumerate(text_chunks):
        tts_wav_name = f"{uuid.uuid4()}_{idx}.wav"
        tts_proc = subprocess.run([
            python_executable, "tts/tortoise/do_tts.py",
            "--text", chunk,
            "--voice", "daniel",
            "--preset", "fast",
            "--output_path", tts_wav_path,
            "--output_name", tts_wav_name
        ])
        tts_wav = os.path.join(tts_wav_path, tts_wav_name)
        if tts_proc.returncode != 0 or not os.path.exists(tts_wav):
            return {"error": "TTS generation failed"}
        audio_segments.append(AudioSegment.from_wav(tts_wav))

    # Concatenate all audio segments
    combined = audio_segments[0]
    for seg in audio_segments[1:]:
        combined += seg
    final_wav_name = f"{uuid.uuid4()}.wav"
    final_wav_path = os.path.join(tts_wav_path, final_wav_name)
    combined.export(final_wav_path, format="wav")

    audio_url = f"/audio/{final_wav_name}"
    return {"audio_url": audio_url, "wav_path": final_wav_path}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("tts_service:app", host="0.0.0.0", port=8001, reload=True)
