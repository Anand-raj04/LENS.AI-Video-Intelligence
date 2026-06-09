# 🎥 LΞNS AI – Video Intelligence Platform

LΞNS AI is an AI-powered Video Intelligence Platform that transforms YouTube videos and audio content into actionable insights. The application automatically downloads audio, generates transcripts, creates summaries, extracts key information, and enables intelligent question-answering through Retrieval-Augmented Generation (RAG).

The platform is designed to help students, researchers, content creators, professionals, and teams quickly understand long-form video content without watching the entire video.

---

# 🚀 Features

## 🎙️ Automatic Speech-to-Text Transcription

* Extracts audio from YouTube videos.
* Supports local audio processing.
* Uses OpenAI Whisper for accurate speech recognition.
* Supports English and Hinglish transcription workflows.

## 📝 AI-Powered Summarization

* Generates concise summaries of lengthy videos.
* Highlights key topics and discussion points.
* Reduces information overload.

## 📌 Automatic Title Generation

* Creates meaningful titles from video content.
* Helps categorize and organize information.

## ✅ Action Item Extraction

Identifies:

* Tasks
* Assignments
* Follow-up actions
* Responsibilities

Useful for:

* Meetings
* Lectures
* Team discussions

## 🔑 Key Decision Detection

Automatically extracts important decisions discussed in the content.

## ❓ Open Question Extraction

Identifies unresolved questions and discussion points.

## 🧠 Retrieval-Augmented Generation (RAG)

* Converts transcripts into vector embeddings.
* Stores embeddings in a vector database.
* Enables contextual question-answering.

Users can chat with the analyzed video and ask questions such as:

* What are the main points?
* What action items were discussed?
* What technologies were mentioned?
* Summarize the section about AI agents.

## 🌐 Interactive Web Interface

Built with:

* HTML
* CSS
* JavaScript
* FastAPI

Provides a clean and responsive user experience.

---

# 🏗️ System Architecture

User Input (YouTube URL / Audio File)

↓
Audio Processing
↓
Speech-to-Text (Whisper / Sarvam)
↓
Transcript Generation
↓
Summary Generation
↓
Information Extraction

├── Action Items

├── Key Decisions

└── Open Questions

↓
Vector Database (ChromaDB)
↓
RAG Question Answering
↓
Interactive Chat Interface

---

# 🛠️ Technologies Used

## Backend

* Python
* FastAPI
* Uvicorn

## Frontend

* HTML5
* CSS3
* JavaScript

## AI & NLP

* OpenAI Whisper
* LangChain
* Retrieval-Augmented Generation (RAG)

## Vector Database

* ChromaDB

## Audio Processing

* yt-dlp
* FFmpeg
* pydub

## APIs

* Sarvam AI Speech-to-Text API
* Mistral (LLM)

## Environment Management

* Python Virtual Environment (venv)
* python-dotenv

---

# 📂 Project Structure

```text
LENS.AI-Video-Intelligence/
│
├── core/
│   ├── transcriber.py
│   ├── summarizer.py
│   ├── extractor.py
│   ├── rag_engine.py
│   └── vector_store.py
│
├── utils/
│   └── audio_processor.py
│
├── static/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── main.py
├── Requirements.txt
├── README.md
└── .env
```

---

# ⚙️ Installation

## 1. Clone Repository

```bash
git clone https://github.com/Anand-raj04/L-NS-AI-Video-Intelligence.git
cd LENS.AI-Video-Intelligence
```

## 2. Create Virtual Environment

```bash
python -m venv .venv
```

Activate:

### Windows

```bash
.venv\Scripts\activate
```

## 3. Install Dependencies

```bash
pip install -r Requirements.txt
```

---

## 4. Configure Environment Variables

Create a `.env` file:

```env
SARVAM_API_KEY=..........
SARVAM_STT_MODEL=saaras:v2.5
MISTRAL_API_KEY=........
WHISPER_MODEL=base
```

---

## 5. Run Application

```bash
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

---

# 🎯 Usage

1. Launch the application.
2. Enter a YouTube URL.
3. Select the desired language mode.
4. Start analysis.
5. Wait for:

   * Transcription
   * Summary generation
   * Information extraction
6. Review generated insights.
7. Ask questions using the RAG chat interface.

---

# 🔍 Example Use Cases

## Students

* Summarize recorded lectures.
* Generate study notes.

## Researchers

* Analyze conference talks.
* Extract key findings.

## Content Creators

* Repurpose long-form content.
* Create blog summaries.

## Teams & Businesses

* Meeting transcription.
* Action item tracking.
* Decision logging.

---

# 📈 Future Improvements

* Multi-language support
* Speaker diarization
* PDF export
* Meeting analytics dashboard
* Real-time transcription
* Cloud deployment
* User authentication
* Persistent chat history

---



# 👨‍💻 Author

**Anand Raj**

AI Developer | Python Developer | Generative AI Enthusiast

GitHub:
https://github.com/Anand-raj04