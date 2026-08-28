"""
Yonder Graph — Raw Knowledge Directory Poller

Background worker that monitors knowledge/raw/ for new files every
POLL_INTERVAL_SECONDS, detects new .txt, .md, .json, .xlsx documents,
and dispatches them to the Enrichment Agent for evaluation.
"""

import os
import sys
import time
import json
import shutil
import logging
from pathlib import Path
from typing import Set

from backend.config import (
    RAW_DIR,
    STAGING_DIR,
    PENDING_REVIEW_DIR,
    ARCHIVE_DIR,
    settings,
)

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".txt", ".md", ".json", ".xlsx", ".docx", ".pdf"}


class RawPoller:
    """
    Background directory watcher for the knowledge/raw/ directory.
    
    Detects new files, dispatches them to the enrichment pipeline,
    and tracks processed files to avoid duplicate processing.
    """

    def __init__(self):
        self._processed_files: Set[str] = set()
        self._poll_interval = settings.poll_interval_seconds

        # Ensure directories exist
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        STAGING_DIR.mkdir(parents=True, exist_ok=True)
        PENDING_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    def scan(self) -> list:
        """
        Scan the raw directory for new files.
        
        Returns a list of new file paths that haven't been processed yet.
        """
        new_files = []

        if not RAW_DIR.exists():
            return new_files

        for root, dirs, files in os.walk(RAW_DIR):
            for filename in files:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                # Skip unsupported files and hidden files
                if ext not in SUPPORTED_EXTENSIONS or filename.startswith("."):
                    continue

                # Skip already-processed files
                file_key = str(filepath)
                if file_key in self._processed_files:
                    continue

                new_files.append(filepath)

        return new_files

    def process_file(self, filepath: Path) -> dict:
        """
        Process a single raw file through the enrichment pipeline.
        
        Steps:
          1. Read file contents
          2. Call the Enrichment Agent for evaluation
          3. Based on confidence score:
             - >= 90%: Auto-ingest to Neo4j and archive
             - < 90%: Stage for SME review
        """
        logger.info("Processing raw file: %s", filepath.name)

        try:
            # Read file contents
            content = self._read_file(filepath)
            if not content:
                logger.warning("Empty or unreadable file: %s", filepath.name)
                return {"status": "skipped", "reason": "empty_file"}

            # Call enrichment agent
            from backend.ingestion.enrichment_agent import enrichment_agent

            result = enrichment_agent.evaluate(
                filename=filepath.name,
                content=content,
                file_type=filepath.suffix.lower(),
            )

            confidence = result.get("confidence_score", 0)
            threshold = settings.auto_ingest_confidence_threshold

            if confidence >= threshold:
                # Auto-ingest and archive
                logger.info(
                    "Auto-ingesting %s (confidence: %.1f%%)",
                    filepath.name,
                    confidence,
                )
                self._archive_file(filepath)
                result["action"] = "auto_ingested"
            else:
                # Stage for SME review
                logger.info(
                    "Staging %s for review (confidence: %.1f%% < %.1f%%)",
                    filepath.name,
                    confidence,
                    threshold,
                )
                self._stage_for_review(filepath, result)
                result["action"] = "staged_for_review"

            self._processed_files.add(str(filepath))
            return result

        except Exception as e:
            logger.error(
                "Failed to process %s: %s", filepath.name, e, exc_info=True
            )
            return {"status": "error", "error": str(e)}

    def _read_file(self, filepath: Path) -> str:
        """Read file contents based on file type."""
        ext = filepath.suffix.lower()

        if ext in (".txt", ".md", ".json"):
            return filepath.read_text(encoding="utf-8", errors="replace")

        elif ext == ".xlsx":
            try:
                import pandas as pd

                xl = pd.ExcelFile(filepath, engine="openpyxl")
                content_parts = []
                for sheet_name in xl.sheet_names:
                    df = pd.read_excel(xl, sheet_name=sheet_name)
                    content_parts.append(
                        f"## Sheet: {sheet_name}\n{df.to_string()}"
                    )
                xl.close()
                return "\n\n".join(content_parts)
            except Exception as e:
                logger.warning("Could not read xlsx %s: %s", filepath.name, e)
                return ""

        elif ext == ".docx":
            try:
                from docx import Document

                doc = Document(filepath)
                return "\n".join(p.text for p in doc.paragraphs)
            except ImportError:
                logger.warning("python-docx not installed — cannot read .docx")
                return filepath.read_text(encoding="utf-8", errors="replace")

        return ""

    def _archive_file(self, filepath: Path) -> None:
        """Move processed file to the archive directory."""
        import datetime

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_name = f"{filepath.stem}_{timestamp}{filepath.suffix}"
        archive_path = ARCHIVE_DIR / archive_name

        shutil.move(str(filepath), str(archive_path))
        logger.info("Archived: %s → %s", filepath.name, archive_path.name)

    def _stage_for_review(self, filepath: Path, result: dict) -> None:
        """Stage file and evaluation results for SME review."""
        # Write evaluation results
        review_payload = {
            "source_file": filepath.name,
            "source_path": str(filepath),
            "evaluation": result,
        }
        review_path = PENDING_REVIEW_DIR / f"{filepath.stem}_review.json"
        review_path.write_text(
            json.dumps(review_payload, indent=2, default=str),
            encoding="utf-8",
        )
        logger.info("Staged for review: %s", review_path.name)

    def run_forever(self) -> None:
        """
        Main polling loop — runs until interrupted.
        
        Scans for new files every POLL_INTERVAL_SECONDS.
        """
        logger.info(
            "Raw Knowledge Poller started (interval: %ds, directory: %s)",
            self._poll_interval,
            RAW_DIR,
        )

        while True:
            try:
                # 1. Periodic 7-day chat retention purge
                try:
                    from backend.database.retention import purge_expired_sessions
                    purge_expired_sessions(days=7)
                except Exception as purge_err:
                    logger.debug("Background retention purge check: %s", purge_err)

                # 2. Knowledge directory scan
                new_files = self.scan()
                if new_files:
                    logger.info("Found %d new file(s) to process", len(new_files))
                    for filepath in new_files:
                        self.process_file(filepath)
                else:
                    logger.debug("No new files detected")

            except KeyboardInterrupt:
                logger.info("Poller shutting down (KeyboardInterrupt)")
                break
            except Exception as e:
                logger.error("Polling cycle error: %s", e, exc_info=True)

            time.sleep(self._poll_interval)


def main():
    """CLI entry point for the raw poller."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
    )
    poller = RawPoller()
    poller.run_forever()


if __name__ == "__main__":
    main()
