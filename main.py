"""
main_api.py  —  LΞNS·AI FastAPI Backend
Wraps the existing run_pipeline() from main.py into a web API.
"""

import asyncio
import json
import time

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Import YOUR existing pipeline functions ──────────────────────────────────
from utils.audio_processor import process_input
from core.transcriber import transcribe_all
from core.summarizer import summarize, generate_title
from core.extractor import (
    extract_action_items,
    extract_key_decisions,
    extract_questions,
)
from core.rag_engine import build_rag_chain, ask_question

load_dotenv()

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="LΞNS·AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static folder  →  index.html, style.css, script.js
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── In-memory session store ──────────────────────────────────────────────────
# key  : session_id  (string)
# value: { rag_chain, title, transcript, summary, ... }
sessions: dict = {}


# ── Request / Response models ────────────────────────────────────────────────
class AnalyseRequest(BaseModel):
    source: str
    language: str = "english"


class ChatRequest(BaseModel):
    session_id: str
    question: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def home():
    """Serve the HTML frontend."""
    with open("static/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/analyse/stream")
async def analyse_stream(req: AnalyseRequest):
    """
    Server-Sent Events endpoint.
    Streams pipeline step updates then the final result — same
    logic as run_pipeline() in main.py but non-blocking.
    """

    async def event_generator():

        def sse(event: str, data: dict) -> str:
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        loop = asyncio.get_event_loop()

        try:
            # ── Step 1: Audio Processing ─────────────────────────────────
            yield sse("step", {"step": "audio", "status": "active"})
            chunks = await loop.run_in_executor(
                None, process_input, req.source
            )
            yield sse("step", {"step": "audio", "status": "done"})

            # ── Step 2: Transcription ────────────────────────────────────
            yield sse("step", {"step": "transcript", "status": "active"})
            transcript = await loop.run_in_executor(
                None, transcribe_all, chunks, req.language
            )
            yield sse("step", {"step": "transcript", "status": "done"})

            # ── Step 3: Title Generation ─────────────────────────────────
            yield sse("step", {"step": "title", "status": "active"})
            title = await loop.run_in_executor(
                None, generate_title, transcript
            )
            yield sse("step", {"step": "title", "status": "done"})

            # ── Step 4: Summarisation ────────────────────────────────────
            yield sse("step", {"step": "summary", "status": "active"})
            summary = await loop.run_in_executor(
                None, summarize, transcript
            )
            yield sse("step", {"step": "summary", "status": "done"})

            # ── Step 5: Extraction ───────────────────────────────────────
            yield sse("step", {"step": "extract", "status": "active"})

            action_item = await loop.run_in_executor(
                None, extract_action_items, transcript
            )
            decisions = await loop.run_in_executor(
                None, extract_key_decisions, transcript
            )
            questions = await loop.run_in_executor(
                None, extract_questions, transcript
            )

            yield sse("step", {"step": "extract", "status": "done"})

            # ── Step 6: RAG Engine ───────────────────────────────────────
            yield sse("step", {"step": "rag", "status": "active"})
            rag_chain = await loop.run_in_executor(
                None, build_rag_chain, transcript
            )
            yield sse("step", {"step": "rag", "status": "done"})

            # ── Save session ─────────────────────────────────────────────
            session_id = f"sess_{int(time.time() * 1000)}"
            sessions[session_id] = {
                "rag_chain":      rag_chain,
                "title":          title,
                "transcript":     transcript,
                "summary":        summary,
                "action_items":   action_item,
                "key_decisions":  decisions,
                "open_questions": questions,
            }

            # ── Send final result to browser ─────────────────────────────
            yield sse("result", {
                "session_id":    session_id,
                "title":         title,
                "transcript":    transcript,
                "summary":       summary,
                "action_items":  action_item,
                "key_decisions": decisions,
                "open_questions": questions,
            })

        except Exception as e:
            yield sse("error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    RAG chat — same as the while-loop in main.py __main__ block
    but as a single HTTP call.
    """
    sess = sessions.get(req.session_id)
    if not sess:
        return {
            "error": "Session not found. Please re-analyse your video."
        }

    loop = asyncio.get_event_loop()
    answer = await loop.run_in_executor(
        None, ask_question, sess["rag_chain"], req.question
    )
    return {"answer": answer}


@app.get("/health")
def health():
    return {"status": "ok", "service": "LΞNS·AI"}