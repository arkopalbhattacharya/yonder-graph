"""
Unit tests for robust LLM JSON parsing and extraction utility.
"""

import unittest
from backend.inference.json_utils import (
    strip_outer_fences,
    extract_json_from_llm,
    extract_sql_from_llm,
    parse_ask_process_response,
    parse_humanizing_response,
)


class TestJsonUtils(unittest.TestCase):

    def test_strip_outer_fences(self):
        text_with_fences = "```json\n{\"key\": \"value\"}\n```"
        self.assertEqual(strip_outer_fences(text_with_fences), '{"key": "value"}')

        text_with_markdown_inside = "```json\n{\"narrative\": \"```sql\\nSELECT 1;\\n```\"}\n```"
        cleaned = strip_outer_fences(text_with_markdown_inside)
        self.assertEqual(cleaned, '{"narrative": "```sql\\nSELECT 1;\\n```"}')

    def test_extract_json_with_inner_codeblocks(self):
        payload = """```json
{
  "query_type": "SCHEMA_STATUS_MAPPING",
  "steps": [
    {
      "step_number": 1,
      "title": "Query Order Header",
      "description": "Inspect the ORD table for status flags.",
      "tables": ["ORD"]
    },
    {
      "step_number": 2,
      "title": "Check Shipment Status",
      "description": "Join SHIPMENT and SHIPMENT_LINE on SHIP_ID.",
      "tables": ["SHIPMENT", "SHIPMENT_LINE"]
    }
  ],
  "narrative": "## Order Status & Shipment ID\\n\\n```sql\\nSELECT * FROM ORD o JOIN SHIPMENT s ON o.ORDNUM = s.ORDNUM WHERE s.SHIP_ID = :ship_id;\\n```\\n\\nThis query filters by shipment ID.",
  "mermaid_diagram": null
}
```"""
        parsed = extract_json_from_llm(payload)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["query_type"], "SCHEMA_STATUS_MAPPING")
        self.assertEqual(len(parsed["steps"]), 2)
        self.assertIn("```sql", parsed["narrative"])
        self.assertIn("SELECT * FROM ORD", parsed["narrative"])

    def test_parse_ask_process_response_exact_user_query_pattern(self):
        payload = """```json
{
  "query_type": "SCHEMA_STATUS_MAPPING",
  "steps": [
    {
      "step_number": 1,
      "title": "Query Order Header Status",
      "description": "Inspect the ORD table to retrieve order-level status.",
      "tables": ["ORD"]
    },
    {
      "step_number": 2,
      "title": "Check Order Line Progress",
      "description": "Join ORD_LINE to evaluate requested and shipped quantities.",
      "tables": ["ORD", "ORD_LINE"]
    },
    {
      "step_number": 3,
      "title": "Check Shipment Status",
      "description": "Join SHIPMENT and SHIPMENT_LINE on SHIP_ID.",
      "tables": ["SHIPMENT", "SHIPMENT_LINE"]
    }
  ],
  "narrative": "## Order Status & Shipment ID Filtering\\n\\n### Order Header (`ORD`)\\n\\n| Column | Type | Definition |\\n|---|---|---|\\n| ORDNUM | VARCHAR2(35) | Order Number |\\n\\n```sql\\nSELECT o.ORDNUM, s.SHIP_ID FROM ORD o JOIN SHIPMENT s ON o.ORDNUM = s.ORDNUM WHERE s.SHIP_ID = :ship_id;\\n```\\n\\nDone.",
  "mermaid_diagram": null
}
```"""
        res = parse_ask_process_response(payload)
        self.assertEqual(res["query_type"], "SCHEMA_STATUS_MAPPING")
        self.assertEqual(len(res["steps"]), 3)
        self.assertIn("## Order Status & Shipment ID Filtering", res["narrative"])
        self.assertNotIn("}, { \"step_number\": 2", res["narrative"])
        self.assertIsNone(res["mermaid_diagram"])

    def test_extract_sql_from_llm(self):
        sql_with_fences = "```sql\nSELECT ORDNUM FROM ORD WHERE ROWNUM <= 100;\n```"
        self.assertEqual(extract_sql_from_llm(sql_with_fences), "SELECT ORDNUM FROM ORD WHERE ROWNUM <= 100")

    def test_trailing_comma_repair(self):
        payload = """{
  "name": "ORD",
  "columns": ["ORDNUM", "WH_ID",],
}"""
        parsed = extract_json_from_llm(payload)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["name"], "ORD")
        self.assertEqual(parsed["columns"], ["ORDNUM", "WH_ID"])

    def test_parse_humanizing_response(self):
        payload = """```json
{
  "l1_summary": "Order 1001 is pending allocation.",
  "l2_summary": "Order ORD1001 status check against ORD and ORD_LINE.",
  "l3_summary": "AST read-only query verified with ROWNUM <= 100.",
  "narrative": "Order 1001 is pending allocation.",
  "reasoning": "🎯 **Intent & Domain Classification**\\n\\nClassified as Outbound domain.\\n\\n📖 **SOP Selection**\\n\\nSelected SOP-OUT-001.",
  "sql_reasoning": "Selects header and line data."
}
```"""
        res = parse_humanizing_response(payload, "ORD1001", "Outbound")
        self.assertEqual(res["l1_summary"], "Order 1001 is pending allocation.")
        self.assertIn("🎯 **Intent & Domain Classification**", res["reasoning"])


if __name__ == "__main__":
    unittest.main()
