"""
Yonder Graph — Document Ingestion & Enrichment API Routes

POST /api/ingest/upload — Accepts document upload, parses text, and runs the Enrichment Agent loop.
"""

import logging
from fastapi import APIRouter, File, UploadFile, HTTPException
from backend.ingestion.doc_parser import extract_text_from_file
from backend.ingestion.enrichment_agent import enrichment_agent

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf", ".ppt", ".pptx", ".xls", ".xlsx", 
    ".csv", ".doc", ".docx", ".txt", ".md"
}

@router.post("/upload")
async def upload_and_enrich_document(file: UploadFile = File(...)):
    """
    Upload a document (PDF, PPT, PPTX, XLS, XLSX, CSV, DOC, DOCX, TXT, MD),
    extract text, evaluate against the 100-point rubric, and ingest into Neo4j
    via the Enrichment Agentic Loop.
    """
    filename = file.filename or "uploaded_document.txt"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ".txt"

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Extract text from document
        extracted_text, file_type = extract_text_from_file(filename, file_bytes)

        if not extracted_text or len(extracted_text.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="Could not extract readable text content from the uploaded file."
            )

        # ── Tier 0 On-Premise PII Sanitization for Knowledge Ingestion ──
        from backend.governance.pii_perimeter import pii_engine
        pii_result = pii_engine.sanitize_text(extracted_text)
        sanitized_content = pii_result["sanitized_text"]

        # Run Enrichment Agentic Loop on sanitized content
        result = enrichment_agent.evaluate_with_agentic_loop(
            filename=filename,
            content=sanitized_content,
            file_type=file_type,
        )

        return {
            "success": True,
            "filename": filename,
            "file_type": file_type,
            "content_preview": sanitized_content[:300] + ("..." if len(sanitized_content) > 300 else ""),
            "pii_sanitization": {
                "masked_count": pii_result["masked_count"],
                "has_pii": pii_result["has_pii"],
            },
            "result": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document ingestion failed for %s: %s", filename, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ingestion agent failed: {str(e)}")
