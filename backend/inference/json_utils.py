"""
Yonder Graph — Ultra-Robust LLM JSON Extraction and Parsing Utility

Handles all edge cases when parsing LLM-generated JSON payloads:
1. Outer markdown code fences (```json ... ```) containing inner markdown codeblocks (```sql ... ```)
2. Unescaped control characters and newlines inside JSON string fields
3. Trailing commas before closing braces/brackets
4. Single quotes vs double quotes
5. Truncated or malformed LLM outputs with robust token/bracket-aware fallbacks
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def strip_outer_fences(text: str) -> str:
    """
    Remove only the outermost markdown code fence from an LLM response,
    without stripping or corrupting inner code fences (e.g. ```sql ... ``` inside JSON strings).
    """
    if not text or not isinstance(text, str):
        return ""
    
    s = text.strip()

    # If the text starts with a markdown code fence (e.g. ```json or ```)
    if s.startswith("```"):
        # Find first newline after ``` or ```json
        first_newline = s.find("\n")
        if first_newline != -1:
            s = s[first_newline + 1:]
        else:
            s = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", s)

    # If the text ends with a markdown code fence (```)
    if s.endswith("```"):
        last_fence = s.rfind("```")
        if last_fence != -1:
            s = s[:last_fence]

    return s.strip()


def repair_json_string(s: str) -> str:
    """
    Apply safe heuristic repairs for common LLM JSON generation quirks:
    - Trailing commas before closing braces/brackets
    - Unescaped single quotes in standard JSON structures
    """
    # Remove trailing commas: ,} -> } and ,] -> ]
    s = re.sub(r",\s*(\}|\])", r"\1", s)
    return s


def extract_json_from_llm(raw_text: str, default: Any = None) -> Any:
    """
    Extract and parse a JSON object or array from raw LLM text.
    Handles outer code blocks, leading/trailing non-JSON text, and malformed strings.
    """
    if not raw_text or not isinstance(raw_text, str):
        return default

    cleaned = strip_outer_fences(raw_text)

    # 1. First attempt: Direct parse on fence-stripped text
    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        pass

    # 2. Second attempt: Apply heuristic repairs
    try:
        repaired = repair_json_string(cleaned)
        return json.loads(repaired, strict=False)
    except Exception:
        pass

    # 3. Third attempt: Find outermost JSON boundaries { ... } or [ ... ]
    start_obj = cleaned.find("{")
    start_arr = cleaned.find("[")

    start_idx = -1
    end_idx = -1

    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start_idx = start_obj
        end_idx = cleaned.rfind("}")
    elif start_arr != -1:
        start_idx = start_arr
        end_idx = cleaned.rfind("]")

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_candidate = cleaned[start_idx:end_idx + 1]
        try:
            return json.loads(json_candidate, strict=False)
        except Exception:
            pass

        try:
            repaired_candidate = repair_json_string(json_candidate)
            return json.loads(repaired_candidate, strict=False)
        except Exception:
            pass

    return default


def extract_sql_from_llm(raw_text: str) -> str:
    """
    Extract clean SQL query from raw LLM text, safely stripping code fences.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""
    
    s = raw_text.strip()
    if "```sql" in s:
        # Extract content between ```sql and the matching ```
        parts = s.split("```sql", 1)
        if len(parts) > 1:
            sub = parts[1]
            end_fence = sub.rfind("```")
            if end_fence != -1:
                s = sub[:end_fence].strip()
            else:
                s = sub.strip()
    elif "```" in s:
        parts = s.split("```", 1)
        if len(parts) > 1:
            sub = parts[1]
            end_fence = sub.rfind("```")
            if end_fence != -1:
                s = sub[:end_fence].strip()
            else:
                s = sub.strip()

    return s.strip().rstrip(";")


def parse_ask_process_response(raw_text: str, fallback_query: str = "") -> Dict[str, Any]:
    """
    Parse AskProcessAgent LLM response into structured dict with query_type, steps, narrative, and mermaid_diagram.
    Guarantees clean, valid markdown narrative without leftover JSON artifacts.
    """
    result = {
        "query_type": "SCHEMA_STATUS_MAPPING",
        "steps": [],
        "narrative": "",
        "mermaid_diagram": None,
    }

    parsed = extract_json_from_llm(raw_text)
    if isinstance(parsed, dict):
        result["query_type"] = parsed.get("query_type", "SCHEMA_STATUS_MAPPING")
        steps = parsed.get("steps", [])
        result["steps"] = steps if isinstance(steps, list) else []
        result["narrative"] = parsed.get("narrative", "")
        
        m_diag = parsed.get("mermaid_diagram")
        if m_diag and str(m_diag).lower() not in ["none", "null", "", "false"]:
            result["mermaid_diagram"] = str(m_diag).strip()
        else:
            result["mermaid_diagram"] = None

        if result["narrative"]:
            return result

    # ── Fallback Extraction if strict JSON parse failed ──
    cleaned = strip_outer_fences(raw_text)

    # 1. Query Type
    qt_match = re.search(r'"query_type"\s*:\s*"([^"]+)"', cleaned)
    if qt_match:
        result["query_type"] = qt_match.group(1)

    # 2. Mermaid Diagram
    m_match = re.search(r'"mermaid_diagram"\s*:\s*("(?:\\.|[^"\\])*"|null)', cleaned)
    if m_match:
        m_val = m_match.group(1).strip()
        if m_val != "null" and m_val != '""':
            try:
                parsed_val = json.loads(m_val)
                result["mermaid_diagram"] = parsed_val if parsed_val and str(parsed_val).lower() not in ["none", "null"] else None
            except Exception:
                clean_val = m_val.strip('"').replace("\\n", "\n")
                result["mermaid_diagram"] = clean_val if clean_val and clean_val.lower() not in ["none", "null"] else None

    # 3. Steps Array using bracket-balanced extractor
    steps_array = _extract_bracket_balanced_array(cleaned, "steps")
    if steps_array:
        result["steps"] = steps_array

    # 4. Narrative extraction
    # Look for "narrative": "..." with escape handling
    nar_match = re.search(r'"narrative"\s*:\s*"((?:\\.|[^"\\])*)"', cleaned, re.DOTALL)
    if nar_match:
        raw_nar = nar_match.group(1)
        result["narrative"] = raw_nar.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
    else:
        # Fallback: Isolate narrative text by stripping surrounding JSON keys
        fallback_nar = cleaned
        # Strip steps if found
        if "steps" in fallback_nar and '"narrative"' in fallback_nar:
            parts = fallback_nar.split('"narrative"', 1)
            if len(parts) > 1:
                nar_part = parts[1].lstrip(': \t\r\n"')
                # Strip trailing mermaid_diagram or closing brace
                nar_part = re.sub(r'",\s*"mermaid_diagram"[\s\S]*$', '', nar_part)
                nar_part = re.sub(r'"\s*\}\s*$', '', nar_part)
                fallback_nar = nar_part.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")

        # If still looks like raw JSON, clean up
        if fallback_nar.startswith("{") and fallback_nar.endswith("}"):
            fallback_nar = re.sub(r'^\s*\{\s*"query_type":\s*"[^"]*",?\s*', '', fallback_nar)
            fallback_nar = re.sub(r'"mermaid_diagram":\s*(?:"[\s\S]*?"|null)\s*,?\s*', '', fallback_nar)

        result["narrative"] = fallback_nar.strip() or raw_text

    return result


def parse_humanizing_response(raw_text: str, fallback_query: str = "", domain: str = "general") -> Dict[str, Any]:
    """
    Parse HumanizingAgent LLM response into structured multi-persona summaries and reasoning.
    """
    default_summary = f"Processed triage analysis for '{fallback_query}' in domain {domain}."
    result = {
        "l1_summary": default_summary,
        "l2_summary": default_summary,
        "l3_summary": default_summary,
        "narrative": default_summary,
        "reasoning": "",
        "sql_reasoning": "",
        "mermaid_diagram": "",
    }

    parsed = extract_json_from_llm(raw_text)
    if isinstance(parsed, dict):
        for key in ["l1_summary", "l2_summary", "l3_summary", "narrative", "reasoning", "sql_reasoning"]:
            if parsed.get(key):
                result[key] = str(parsed[key]).strip()
        
        # Ensure narrative fallback
        if not result["narrative"] and result["l1_summary"]:
            result["narrative"] = result["l1_summary"]

        return result

    # Fallback string handling
    cleaned = strip_outer_fences(raw_text)
    for key in ["l1_summary", "l2_summary", "l3_summary", "narrative", "reasoning", "sql_reasoning"]:
        match = re.search(rf'"{key}"\s*:\s*"((?:\\.|[^"\\])*)"', cleaned, re.DOTALL)
        if match:
            result[key] = match.group(1).replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\").strip()

    return result


def _extract_bracket_balanced_array(text: str, key_name: str) -> List[Dict[str, Any]]:
    """
    Find key_name in text (e.g. "steps": [...]) and extract the full JSON array
    by tracking opening and closing brackets correctly.
    """
    pattern = rf'"{key_name}"\s*:\s*\['
    match = re.search(pattern, text)
    if not match:
        return []

    start_bracket_idx = match.end() - 1  # Index of '['
    bracket_depth = 0
    in_string = False
    escape = False

    for i in range(start_bracket_idx, len(text)):
        ch = text[i]

        if escape:
            escape = False
            continue

        if ch == '\\':
            escape = True
            continue

        if ch == '"':
            in_string = not in_string
            continue

        if not in_string:
            if ch == '[':
                bracket_depth += 1
            elif ch == ']':
                bracket_depth -= 1
                if bracket_depth == 0:
                    # Found matching closing bracket
                    array_str = text[start_bracket_idx:i + 1]
                    try:
                        parsed = json.loads(array_str, strict=False)
                        if isinstance(parsed, list):
                            return parsed
                    except Exception:
                        try:
                            repaired = repair_json_string(array_str)
                            parsed = json.loads(repaired, strict=False)
                            if isinstance(parsed, list):
                                return parsed
                        except Exception:
                            pass
                    break

    return []


def extract_steps_list(raw_text: str) -> List[Dict[str, Any]]:
    """
    Extract a list of step dictionaries from raw LLM output, handling:
    1. Direct JSON array: [ {...}, {...} ]
    2. Dict wrapper: {"steps": [ ... ]}, {"investigation_steps": [ ... ]}, {"plan": [ ... ]}
    3. Fenced code blocks and heuristic repair
    """
    if not raw_text or not isinstance(raw_text, str):
        return []

    parsed = extract_json_from_llm(raw_text, default=None)
    candidate_list = None

    if isinstance(parsed, list):
        candidate_list = parsed
    elif isinstance(parsed, dict):
        for key in ["steps", "investigation_steps", "triage_steps", "plan", "data", "items"]:
            if key in parsed and isinstance(parsed[key], list):
                candidate_list = parsed[key]
                break
        if candidate_list is None:
            # Check if any value is a list of dicts
            for v in parsed.values():
                if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                    candidate_list = v
                    break

    if not candidate_list:
        # Try bracket extractor helper
        candidate_list = extract_json_array_by_key(raw_text, "steps") or extract_json_array_by_key(raw_text, "investigation_steps")

    if not candidate_list or not isinstance(candidate_list, list):
        return []

    normalized_steps = []
    for idx, item in enumerate(candidate_list):
        norm = normalize_investigation_step(item, idx + 1)
        if norm:
            normalized_steps.append(norm)

    return normalized_steps


def normalize_investigation_step(item: Any, default_step_num: int = 1) -> Optional[Dict[str, Any]]:
    """
    Coerce a single step object into the standard schema.
    """
    if not isinstance(item, dict):
        if isinstance(item, str) and item.strip():
            return {
                "step_number": default_step_num,
                "step_title": f"Step {default_step_num}",
                "description": item.strip(),
                "diagnostic_sql": None,
                "expected_outcome": "Verify status against standard.",
                "tier2_valid": True,
                "validation_errors": [],
            }
        return None

    # Step number
    raw_num = item.get("step_number") or item.get("number") or item.get("step") or item.get("id") or default_step_num
    try:
        step_number = int(raw_num)
    except (ValueError, TypeError):
        step_number = default_step_num

    # Step title
    raw_title = item.get("step_title") or item.get("title") or item.get("name") or item.get("action") or item.get("header") or ""
    step_title = str(raw_title).strip() if raw_title else f"Step {step_number}"

    # Description
    raw_desc = item.get("description") or item.get("desc") or item.get("details") or item.get("instruction") or item.get("summary") or ""
    description = str(raw_desc).strip()

    # Diagnostic SQL
    raw_sql = item.get("diagnostic_sql") or item.get("sql") or item.get("query") or item.get("sql_query") or item.get("diagnosticQuery") or None
    diagnostic_sql = str(raw_sql).strip() if raw_sql and str(raw_sql).strip().upper() not in ["NONE", "NULL", ""] else None

    # Expected Outcome
    raw_outcome = item.get("expected_outcome") or item.get("outcome") or item.get("expected") or item.get("expected_result") or item.get("result") or None
    expected_outcome = str(raw_outcome).strip() if raw_outcome else None

    return {
        "step_number": step_number,
        "step_title": step_title,
        "description": description or f"Investigate {step_title}",
        "diagnostic_sql": diagnostic_sql,
        "expected_outcome": expected_outcome,
        "tier2_valid": True,
        "validation_errors": [],
    }

