"""
Tests for Intent Recognition Guardrails and Out-of-Scope Query Interception
"""

import unittest
from unittest.mock import patch
from backend.inference.orchestrator import TriageOrchestrator


class TestIntentClassifierGuardrails(unittest.TestCase):
    def setUp(self):
        self.orchestrator = TriageOrchestrator()

    def test_greeting_classification(self):
        res = self.orchestrator._classify_intent("hello", session_id="test-session")
        self.assertEqual(res.get("intent"), "GREETING")

    def test_out_of_scope_fastpath_fallback(self):
        # Query without any supply chain terms
        res = self.orchestrator._classify_intent("hows the weather today in texas", session_id="test-session")
        self.assertEqual(res.get("intent"), "OUT_OF_SCOPE")

    def test_out_of_scope_trivia_query(self):
        res = self.orchestrator._classify_intent("who won the world cup in 2022?", session_id="test-session")
        self.assertEqual(res.get("intent"), "OUT_OF_SCOPE")

    def test_out_of_scope_cooking_query(self):
        res = self.orchestrator._classify_intent("give me a recipe for chocolate chip cookies", session_id="test-session")
        self.assertEqual(res.get("intent"), "OUT_OF_SCOPE")

    def test_general_process_inquiry(self):
        res = self.orchestrator._classify_intent("how can i view an order status and also filter with shipment id", session_id="test-session")
        self.assertEqual(res.get("intent"), "GENERAL_PROCESS_INQUIRY")

    def test_incident_triage_query(self):
        res = self.orchestrator._classify_intent("Order ORD123 is stuck in Planned status at WH01", session_id="test-session")
        self.assertEqual(res.get("intent"), "INCIDENT_TRIAGE")

    @patch("backend.inference.orchestrator.pii_engine.sanitize_text")
    def test_run_triage_out_of_scope_execution(self, mock_pii):
        mock_pii.return_value = {
            "sanitized_text": "hows the weather today in texas",
            "has_pii": False,
            "masked_count": 0,
            "masked_entities": [],
        }
        res = self.orchestrator.run_triage("hows the weather today in texas")
        self.assertEqual(res.get("status"), "out_of_scope")
        self.assertEqual(res.get("intent"), "OUT_OF_SCOPE")
        self.assertIn("Supply Chain, Warehouse Management Systems", res.get("narrative", ""))
        self.assertIsNone(res.get("diagnostic_sql"))
        self.assertEqual(len(res.get("steps", [])), 0)
        self.assertEqual(len(res.get("investigation_steps", [])), 0)
        
        # Verify no DomainKnowledgeAgent or GraphRAG agents were invoked
        agent_names = [t.get("agent") for t in res.get("agent_traces", [])]
        self.assertNotIn("DomainKnowledgeAgent", agent_names)
        self.assertNotIn("GraphRAGDiagnosticAgent", agent_names)
        self.assertNotIn("AskProcessAgent", agent_names)

    @patch("backend.inference.orchestrator.pii_engine.sanitize_text")
    def test_process_inquiry_in_resolve_mode_blocked(self, mock_pii):
        mock_pii.return_value = {
            "sanitized_text": "how can i view an order status and also filter with shipment id",
            "has_pii": False,
            "masked_count": 0,
            "masked_entities": [],
        }
        res = self.orchestrator.run_triage(
            "how can i view an order status and also filter with shipment id",
            persona="resolve",
        )
        self.assertEqual(res.get("status"), "mode_mismatch")
        self.assertEqual(res.get("intent"), "GENERAL_PROCESS_INQUIRY")
        self.assertEqual(res.get("persona"), "resolve")
        self.assertIn("Mode Mismatch: Please Switch to Ask Mode", res.get("narrative", ""))
        self.assertIn("Ask Mode", res.get("persona_summaries", {}).get("l1", ""))

    @patch("backend.inference.orchestrator.pii_engine.sanitize_text")
    def test_incident_triage_in_ask_mode_blocked(self, mock_pii):
        mock_pii.return_value = {
            "sanitized_text": "Order ORD123 is stuck in Planned status at WH01",
            "has_pii": False,
            "masked_count": 0,
            "masked_entities": [],
        }
        res = self.orchestrator.run_triage(
            "Order ORD123 is stuck in Planned status at WH01",
            persona="ask",
        )
        self.assertEqual(res.get("status"), "mode_mismatch")
        self.assertEqual(res.get("intent"), "INCIDENT_TRIAGE")
        self.assertEqual(res.get("persona"), "ask")
        self.assertIn("Mode Mismatch: Please Switch to Resolve Mode", res.get("narrative", ""))
        self.assertIn("Resolve Mode", res.get("persona_summaries", {}).get("l1", ""))


class TestInvestigationStepsStandardization(unittest.TestCase):
    """Test suite for robust investigation steps parsing and schema normalization."""

    def test_direct_json_array(self):
        from backend.inference.json_utils import extract_steps_list
        raw = """
        [
            {
                "step_number": 1,
                "step_title": "Check Wave Allocation",
                "description": "Inspect wave allocation flags in PCKWAV",
                "diagnostic_sql": "SELECT * FROM pckwav WHERE wavnum = :wavnum AND ROWNUM <= 100",
                "expected_outcome": "WAVSTS is 'R'"
            }
        ]
        """
        steps = extract_steps_list(raw)
        self.assertEqual(len(steps), 1)
        self.assertEqual(steps[0]["step_number"], 1)
        self.assertEqual(steps[0]["step_title"], "Check Wave Allocation")
        self.assertTrue(steps[0]["diagnostic_sql"].startswith("SELECT"))

    def test_wrapped_dict_with_variant_keys(self):
        from backend.inference.json_utils import extract_steps_list
        raw = """
        ```json
        {
            "investigation_steps": [
                {
                    "title": "Verify Inventory Status",
                    "details": "Check invdtl for holds",
                    "sql": "SELECT * FROM invdtl WHERE prtnum = :sku AND ROWNUM <= 100",
                    "outcome": "No active holds"
                }
            ]
        }
        ```
        """
        steps = extract_steps_list(raw)
        self.assertEqual(len(steps), 1)
        self.assertEqual(steps[0]["step_number"], 1)
        self.assertEqual(steps[0]["step_title"], "Verify Inventory Status")
        self.assertEqual(steps[0]["description"], "Check invdtl for holds")
        self.assertEqual(steps[0]["expected_outcome"], "No active holds")

    def test_sop_fallback_decomposition(self):
        sop = {
            "sop_id": "SOP-INV-002",
            "triage_steps": "1. Check MovementWork/PickWork status\n2. Review InventoryLoad.stoloc history\n3. Compare Location.CURQVL",
        }
        orch = TriageOrchestrator()
        steps = orch._synthesize_investigation_steps(
            query="SKU 123 mismatch",
            matched_sop=sop,
            sql_result={"display_sql": "SELECT * FROM locmst WHERE stoloc = :stoloc AND ROWNUM <= 100"},
            business_keys={"sku": "123"},
            domain="Inventory",
        )
        self.assertGreaterEqual(len(steps), 1)
        self.assertIn("step_title", steps[0])
        self.assertIn("diagnostic_sql", steps[0])
        self.assertTrue(steps[0]["tier2_valid"])


if __name__ == "__main__":
    unittest.main()

