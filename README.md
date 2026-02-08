# DDS Provider Scraper

Local FastAPI app that lists DDS providers by town and lets you download provider profile PDFs.

## Setup

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000` in your browser.

## Notes

- The app scrapes the DDS "providers by town" page and parses the town PDF to extract provider profile PDF links.
- Provider list parsing is heuristic because the PDFs are formatted for humans, not machines.
