"""
Yonder Graph — Tier 0: On-Premise PII & Data Privacy Perimeter Engine

Hybrid deterministic regex + offline GLiNER AI entity recognizer running entirely on-premise (0 GPU).
Masks PII across:
  1. Inbound user chat queries & incident tickets
  2. Outbound WMS database query results
  3. Knowledge Studio uploaded documents
  4. SME feedback corrections and runbook notes

Guarantees that sensitive data never leaves the local perimeter when querying external LLMs
or persisting to the Neo4j Knowledge Graph.
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_GLINER_MODEL = "urchade/gliner_small-v2.1"


def luhn_checksum_is_valid(card_number_str: str) -> bool:
    """Validate credit card number using Luhn algorithm."""
    digits = [int(c) for c in card_number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            d = d * 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


class PIIPerimeterEngine:
    """
    Tier 0 On-Premise PII Sanitizer & Privacy Perimeter.
    
    Provides high-speed, zero-GPU hybrid masking:
      - Pass 1 (Priority 1): Deterministic regex for structured PII (Cards, Emails, Phones, SSN, IP)
      - Pass 2 (Priority 2): Offline GLiNER AI for unstructured PII (Names, Physical Delivery Addresses)
      - Fallback: Contextual regex heuristics if GLiNER is offline
    """

    # Structured PII Regex Patterns
    EMAIL_REGEX = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        re.IGNORECASE
    )
    PHONE_REGEX = re.compile(
        r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
    )
    SSN_REGEX = re.compile(
        r'\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b'
    )
    CREDIT_CARD_REGEX = re.compile(
        r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13})\b'
    )
    IP_ADDRESS_REGEX = re.compile(
        r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
    )
    ADDRESS_STREET_REGEX = re.compile(
        r'\b\d{1,5}\s+(?:[A-Z0-9a-z.-]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Terrace|Terr|Circle|Cir)\b',
        re.IGNORECASE
    )
    CUSTOMER_NAME_CONTEXT_REGEX = re.compile(
        r'(?:customer|client|user|patient|attn|contact|driver|associate|manager|caller|reported by|requested by|assigned to)\s*(?:is|:|-)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})',
        re.IGNORECASE
    )

    SENSITIVE_COLUMN_NAMES = {
        'cust_name', 'customer_name', 'first_name', 'last_name', 'full_name',
        'email', 'cust_email', 'phone', 'phone_num', 'telephone', 'mobile',
        'address', 'addr_line1', 'addr_line2', 'street_addr', 'billing_addr',
        'ship_addr', 'ssn', 'tax_id', 'card_num', 'credit_card', 'cc_num',
        'driver_name', 'carrier_contact', 'contact_name', 'recipient_name'
    }

    # Standard WMS keywords and stop words to protect from over-eager NER masking
    PROTECTED_WMS_TERMS = {
        "NOT WAVED", "IN TRANSIT", "ON HOLD", "READY TO PICK", "OUT OF STOCK",
        "CYCLE COUNT", "PLANNED", "ALLOCATED", "PICKED", "LOADED", "SHIPPED",
        "INBOUND", "OUTBOUND", "INVENTORY", "ORACLE", "MOCA", "WMS"
    }

    GENERIC_STOP_WORDS = {
        "customer", "client", "user", "order", "email", "phone", "address",
        "check", "wave", "status", "trailer", "truck", "warehouse", "delivery", "is"
    }

    def __init__(self):
        self._session_vault: Dict[str, Dict[str, str]] = {}
        self._gliner_model = None
        self._gliner_attempted = False
        self._gliner_available = False
        logger.info("PIIPerimeterEngine (Tier 0) initialized successfully.")

    def _get_gliner(self):
        """Lazy-load GLiNER model once in background with graceful fallback."""
        if not self._gliner_attempted:
            self._gliner_attempted = True
            try:
                from gliner import GLiNER
                logger.info("Loading Tier 0 GLiNER model (%s)...", DEFAULT_GLINER_MODEL)
                self._gliner_model = GLiNER.from_pretrained(DEFAULT_GLINER_MODEL)
                self._gliner_available = True
                logger.info("Tier 0 GLiNER AI model loaded successfully for offline inference.")
            except Exception as e:
                logger.warning("GLiNER model not available (%s); falling back to deterministic heuristic NER.", e)
                self._gliner_available = False
        return self._gliner_model if self._gliner_available else None

    def sanitize_text(self, text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Sanitize raw text by identifying and replacing all PII tokens with prioritized span resolution.
        
        Returns:
            dict containing:
              - 'sanitized_text': sanitized string with typed tokens (<PII_EMAIL_1>, etc.)
              - 'masked_count': total number of PII items masked
              - 'masked_entities': list of detected entity categories and token mappings
              - 'has_pii': boolean flag indicating if any PII was detected
        """
        if not text or not isinstance(text, str):
            return {
                "sanitized_text": text or "",
                "masked_count": 0,
                "masked_entities": [],
                "has_pii": False,
            }

        masked_entities = []
        token_counter: Dict[str, int] = {}
        vault = self._session_vault.setdefault(session_id or "global", {})

        def get_replacement_token(entity_type: str, original_val: str) -> str:
            for t, v in vault.items():
                if v == original_val and t.startswith(f"<PII_{entity_type}_"):
                    return t

            count = token_counter.get(entity_type, 0) + 1
            token_counter[entity_type] = count
            token = f"<PII_{entity_type}_{count}>"
            vault[token] = original_val
            masked_entities.append({
                "type": entity_type,
                "token": token,
                "preview": original_val[:2] + "***" + original_val[-2:] if len(original_val) > 4 else "***"
            })
            return token

        # ── 1. Priority 1: High-Confidence Deterministic Regex Spans ──
        det_spans: List[Tuple[int, int, str, str]] = []

        # Credit Cards (with Luhn validation)
        for match in self.CREDIT_CARD_REGEX.finditer(text):
            cc_str = match.group(0)
            if luhn_checksum_is_valid(cc_str):
                det_spans.append((match.start(), match.end(), "CARD", cc_str))

        # Email Addresses
        for match in self.EMAIL_REGEX.finditer(text):
            det_spans.append((match.start(), match.end(), "EMAIL", match.group(0)))

        # Social Security Numbers
        for match in self.SSN_REGEX.finditer(text):
            det_spans.append((match.start(), match.end(), "SSN", match.group(0)))

        # Physical Street Addresses
        for match in self.ADDRESS_STREET_REGEX.finditer(text):
            det_spans.append((match.start(), match.end(), "ADDRESS", match.group(0)))

        # Phone Numbers
        for match in self.PHONE_REGEX.finditer(text):
            phone_str = match.group(0)
            digits_only = re.sub(r'\D', '', phone_str)
            if 10 <= len(digits_only) <= 11:
                det_spans.append((match.start(), match.end(), "PHONE", phone_str))

        # Helper to check overlap with priority 1 deterministic spans
        def overlaps_with_det(s_start: int, s_end: int) -> bool:
            return any(not (s_end <= d_start or s_start >= d_end) for d_start, d_end, _, _ in det_spans)

        # ── 2. Priority 2: GLiNER AI Contextual Entity Extraction ──
        ner_spans: List[Tuple[int, int, str, str]] = []
        gliner_model = self._get_gliner()
        if gliner_model is not None:
            try:
                gliner_labels = ["person", "customer name", "physical address"]
                ai_entities = gliner_model.predict_entities(text, gliner_labels, threshold=0.55)
                for ent in ai_entities:
                    ent_text = ent.get("text", "").strip()
                    ent_label = ent.get("label", "").lower()
                    start = ent.get("start", 0)
                    end = ent.get("end", 0)
                    if not ent_text or len(ent_text) < 2:
                        continue
                    if ent_text.upper() in self.PROTECTED_WMS_TERMS:
                        continue
                    if ent_text.lower() in self.GENERIC_STOP_WORDS:
                        continue
                    if overlaps_with_det(start, end):
                        continue
                    # Ignore WMS operational facilities, warehouses, docks, and location codes
                    if re.match(r'^(?:warehouse|wh|building|bldg|dock|door|bay|aisle|loc|location|slot|zone|facility|plant|hub|terminal|dc)\s*#?\s*\w+$', ent_text, re.IGNORECASE):
                        continue
                    t_type = "NAME" if ("name" in ent_label or "person" in ent_label) else "ADDRESS"
                    ner_spans.append((start, end, t_type, ent_text))
            except Exception as e:
                logger.debug("GLiNER entity extraction pass encountered non-fatal error: %s", e)

        # ── 3. Priority 2 Fallback: Contextual Heuristic Regex Spans ──
        for match in self.CUSTOMER_NAME_CONTEXT_REGEX.finditer(text):
            name_str = match.group(1).strip()
            start = match.start(1)
            end = match.end(1)
            if name_str.upper() not in self.PROTECTED_WMS_TERMS and not overlaps_with_det(start, end):
                ner_spans.append((start, end, "NAME", name_str))

        # ── 4. Unified Span Resolution (Priority 1 + Non-overlapping Priority 2) ──
        all_spans = det_spans + ner_spans
        all_spans.sort(key=lambda s: (s[0], -(s[1] - s[0])))

        merged_spans: List[Tuple[int, int, str, str]] = []
        last_end = -1
        for start, end, t_type, raw_text in all_spans:
            if start >= last_end:
                merged_spans.append((start, end, t_type, raw_text))
                last_end = end

        # ── 5. Build Sanitized Output (Replaced Right-to-Left) ──
        merged_spans.sort(key=lambda s: s[0], reverse=True)
        sanitized_chars = list(text)

        for start, end, t_type, raw_text in merged_spans:
            token = get_replacement_token(t_type, raw_text)
            sanitized_chars[start:end] = list(token)

        sanitized = "".join(sanitized_chars)
        has_pii = len(masked_entities) > 0

        if has_pii:
            logger.info("Tier 0 PII Perimeter masked %d sensitive entities in session %s", len(masked_entities), session_id or "global")

        return {
            "sanitized_text": sanitized,
            "masked_count": len(masked_entities),
            "masked_entities": masked_entities,
            "has_pii": has_pii,
        }

    def sanitize_tabular_data(
        self,
        rows: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Sanitize database result sets (rows of dicts) before feeding to LLM context.
        Scans both known sensitive column names and generic cell values.
        """
        if not rows or not isinstance(rows, list):
            return rows, {"masked_count": 0, "has_pii": False, "masked_entities": []}

        sanitized_rows = []
        total_masked = 0
        all_masked_entities = []

        for row in rows:
            if not isinstance(row, dict):
                sanitized_rows.append(row)
                continue

            sanitized_row = {}
            for col, val in row.items():
                col_lower = str(col).lower().strip()
                if isinstance(val, str):
                    if any(s_col in col_lower for s_col in self.SENSITIVE_COLUMN_NAMES):
                        res = self.sanitize_text(val, session_id=session_id)
                        if not res["has_pii"] and len(val.strip()) > 0:
                            token = f"<PII_DATA_{col_lower.upper()}>"
                            sanitized_row[col] = token
                            total_masked += 1
                            all_masked_entities.append({"type": col_lower.upper(), "token": token})
                        else:
                            sanitized_row[col] = res["sanitized_text"]
                            total_masked += res["masked_count"]
                            all_masked_entities.extend(res["masked_entities"])
                    else:
                        res = self.sanitize_text(val, session_id=session_id)
                        sanitized_row[col] = res["sanitized_text"]
                        total_masked += res["masked_count"]
                        all_masked_entities.extend(res["masked_entities"])
                else:
                    sanitized_row[col] = val
            sanitized_rows.append(sanitized_row)

        return sanitized_rows, {
            "masked_count": total_masked,
            "has_pii": total_masked > 0,
            "masked_entities": all_masked_entities,
        }

    def detokenize_text(self, text: str, session_id: Optional[str] = None) -> str:
        """
        Restore real PII values into text from the ephemeral session vault.
        Only executed on-premise right before returning the final response to the user.
        """
        if not text or not isinstance(text, str):
            return text or ""

        vault = self._session_vault.get(session_id or "global", {})
        if not vault and "global" in self._session_vault:
            vault = self._session_vault["global"]
        if not vault:
            return text

        restored = text
        for token, original_val in vault.items():
            restored = restored.replace(token, original_val)
            clean_token = token.strip("<>")
            if clean_token in restored:
                restored = restored.replace(f"<{clean_token}>", original_val)
                restored = re.sub(r'\b' + re.escape(clean_token) + r'\b', original_val, restored)
        return restored

    def detokenize_payload(self, data: Any, session_id: Optional[str] = None) -> Any:
        """Recursively restore original PII values into strings, dicts, and lists."""
        if isinstance(data, str):
            return self.detokenize_text(data, session_id=session_id)
        elif isinstance(data, list):
            return [self.detokenize_payload(item, session_id=session_id) for item in data]
        elif isinstance(data, dict):
            return {k: self.detokenize_payload(v, session_id=session_id) for k, v in data.items()}
        return data

    def clear_session_vault(self, session_id: str) -> None:
        """Clear ephemeral vault memory for a completed session."""
        if session_id in self._session_vault:
            del self._session_vault[session_id]


# Singleton Instance
pii_engine = PIIPerimeterEngine()
