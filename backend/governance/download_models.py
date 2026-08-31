"""
Yonder Graph — Tier 0 Offline Model Pre-warming Script

Downloads and caches lightweight on-premise AI models (e.g. GLiNER) for Tier 0 PII Perimeter.
Run once during VM provisioning or container image builds:
  python -m backend.governance.download_models
"""

import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_GLINER_MODEL = "urchade/gliner_small-v2.1"


def download_gliner_model(model_name: str = DEFAULT_GLINER_MODEL) -> bool:
    """Pre-download GLiNER model to local HuggingFace cache."""
    logger.info("Initializing Tier 0 GLiNER model pre-fetch: %s", model_name)
    try:
        from gliner import GLiNER
        logger.info("Downloading and caching %s to local disk...", model_name)
        model = GLiNER.from_pretrained(model_name)
        logger.info("GLiNER model '%s' successfully cached and ready for offline CPU inference.", model_name)
        return True
    except ImportError:
        logger.warning("gliner package is not installed. Run: pip install gliner")
        return False
    except Exception as e:
        logger.error("Failed to download GLiNER model: %s", e)
        return False


if __name__ == "__main__":
    success = download_gliner_model()
    sys.exit(0 if success else 1)
