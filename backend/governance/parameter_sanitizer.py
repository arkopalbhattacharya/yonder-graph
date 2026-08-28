"""
Yonder Graph — Parameter Sanitizer

Enforces regex format validation for Oracle WMS business keys
(ORDNUM, LODNUM, DTLNUM, WH_ID, etc.) and sanitizes input values
to prevent SQL injection and malformed parameter binding.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Business Key Format Patterns
# ──────────────────────────────────────────────────────────────
# Each pattern maps a parameter name to its expected regex format.

BUSINESS_KEY_PATTERNS: Dict[str, re.Pattern] = {
    # Order number: alphanumeric, hyphens, underscores (5-30 chars)
    "ordnum": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Order line number: numeric or alphanumeric short codes
    "ordlin": re.compile(r"^[A-Za-z0-9\-_]{1,10}$"),
    # Order sub-line number
    "ordsln": re.compile(r"^[A-Za-z0-9\-_]{1,10}$"),
    # Warehouse ID: short alphanumeric code
    "wh_id": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Load number (LPN/container)
    "lodnum": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Inventory detail number
    "dtlnum": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Part/item number
    "prtnum": re.compile(r"^[A-Za-z0-9\-_.]{1,40}$"),
    # Client ID
    "client_id": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Wave number
    "wave_num": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Wave set
    "wave_set": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Shipment number
    "ship_id": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Stop ID
    "stop_id": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Carrier code
    "carcod": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Service level
    "srvlvl": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
    # Storage location
    "stoloc": re.compile(r"^[A-Za-z0-9\-_.]{1,30}$"),
    # Receive number
    "rcvnum": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Receive line
    "rcvlin": re.compile(r"^[A-Za-z0-9\-_]{1,10}$"),
    # Purchase order
    "invnum": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Supplier number
    "supnum": re.compile(r"^[A-Za-z0-9\-_]{1,30}$"),
    # Trailer number
    "trlr_num": re.compile(r"^[A-Za-z0-9\-_]{3,30}$"),
    # Appointment ID
    "appt_id": re.compile(r"^[A-Za-z0-9\-_]{1,20}$"),
}

# Characters that must NEVER appear in parameter values
FORBIDDEN_CHARS = re.compile(r"[;'\"\\\x00-\x1f]")

# Oracle bind parameter extraction pattern
BIND_PARAM_EXTRACTOR = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")


class ParameterSanitizer:
    """
    Validates and sanitizes Oracle WMS business key parameters.
    
    Enforces strict regex patterns for known keys, escapes dangerous
    characters, and extracts bind parameters from SQL templates.
    """

    @staticmethod
    def validate_parameter(
        param_name: str, param_value: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate a single parameter against its business key pattern.
        
        Returns:
            (is_valid, error_message) tuple.
        """
        if not isinstance(param_value, str):
            param_value = str(param_value)

        # Check for forbidden characters (SQL injection vectors)
        if FORBIDDEN_CHARS.search(param_value):
            return False, (
                f"Parameter '{param_name}' contains forbidden characters. "
                f"Values must not include semicolons, quotes, backslashes, "
                f"or control characters."
            )

        # Check against known business key patterns
        normalized_name = param_name.lower().strip().lstrip(":")
        if normalized_name in BUSINESS_KEY_PATTERNS:
            pattern = BUSINESS_KEY_PATTERNS[normalized_name]
            if not pattern.match(param_value):
                return False, (
                    f"Parameter '{param_name}' value '{param_value}' does not "
                    f"match the expected format: {pattern.pattern}"
                )

        return True, None

    @staticmethod
    def validate_parameters(
        parameters: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Validate all parameters in a dictionary.
        
        Returns:
            (all_valid, list_of_error_messages) tuple.
        """
        errors = []
        for name, value in parameters.items():
            if value is None:
                continue
            is_valid, error = ParameterSanitizer.validate_parameter(
                name, str(value)
            )
            if not is_valid:
                errors.append(error)

        return len(errors) == 0, errors

    @staticmethod
    def sanitize_value(value: str) -> str:
        """
        Escape a parameter value for safe use in Oracle SQL.
        
        Strips dangerous characters while preserving the business value.
        """
        if not isinstance(value, str):
            value = str(value)

        # Remove forbidden characters
        sanitized = FORBIDDEN_CHARS.sub("", value)
        # Trim whitespace
        sanitized = sanitized.strip()
        return sanitized

    @staticmethod
    def sanitize_parameters(
        parameters: Dict[str, Any]
    ) -> Dict[str, str]:
        """Sanitize all values in a parameter dictionary."""
        return {
            k: ParameterSanitizer.sanitize_value(str(v))
            for k, v in parameters.items()
            if v is not None
        }

    @staticmethod
    def extract_bind_params(sql: str) -> List[str]:
        """
        Extract all Oracle bind parameter names from a SQL template.
        
        Matches patterns like :ordnum, :wh_id, :wave_num.
        """
        return BIND_PARAM_EXTRACTOR.findall(sql)

    @staticmethod
    def bind_parameters(
        sql_template: str, parameters: Dict[str, Any]
    ) -> Tuple[str, Dict[str, str], List[str]]:
        """
        Safely bind parameters to an Oracle SQL template.
        
        Validates and sanitizes all parameters, then performs the binding.
        Oracle bind variables (:param_name) are preserved for parameterized
        execution — values are returned separately for safe binding.
        
        Returns:
            (display_sql, sanitized_params, errors) tuple.
            - display_sql: SQL with parameter values shown for display
            - sanitized_params: Cleaned parameter dict for safe execution
            - errors: Any validation errors encountered
        """
        required_params = ParameterSanitizer.extract_bind_params(sql_template)
        sanitized = ParameterSanitizer.sanitize_parameters(parameters)
        errors = []

        # Validate all provided parameters
        for param_name in required_params:
            if param_name not in sanitized:
                errors.append(
                    f"Required bind parameter ':{param_name}' not provided"
                )
                continue

            is_valid, error = ParameterSanitizer.validate_parameter(
                param_name, sanitized[param_name]
            )
            if not is_valid:
                errors.append(error)

        # Generate display SQL (for human review only — NOT for execution)
        display_sql = sql_template
        for param_name, value in sanitized.items():
            display_sql = display_sql.replace(
                f":{param_name}", f"'{value}'"
            )

        return display_sql, sanitized, errors


# Module-level singleton
parameter_sanitizer = ParameterSanitizer()
