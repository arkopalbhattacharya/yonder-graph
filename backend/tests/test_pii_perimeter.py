"""
Unit tests for Tier 0 On-Premise PII & Data Privacy Perimeter Engine.
"""

import unittest
from backend.governance.pii_perimeter import PIIPerimeterEngine, luhn_checksum_is_valid


class TestPIIPerimeterEngine(unittest.TestCase):

    def setUp(self):
        self.engine = PIIPerimeterEngine()

    def test_luhn_checksum(self):
        # Valid test card (Visa test pattern)
        self.assertTrue(luhn_checksum_is_valid("4532015112830366"))
        # Invalid test card
        self.assertFalse(luhn_checksum_is_valid("4532015112830367"))

    def test_email_masking(self):
        text = "Customer email is support-ops@acme-corp.com, please check wave."
        result = self.engine.sanitize_text(text, session_id="test_sess_1")
        self.assertTrue(result["has_pii"])
        self.assertIn("<PII_EMAIL_1>", result["sanitized_text"])
        self.assertNotIn("support-ops@acme-corp.com", result["sanitized_text"])

    def test_phone_masking(self):
        text = "Call carrier driver at (555) 234-5678 regarding trailer."
        result = self.engine.sanitize_text(text, session_id="test_sess_2")
        self.assertTrue(result["has_pii"])
        self.assertIn("<PII_PHONE_1>", result["sanitized_text"])
        self.assertNotIn("555) 234-5678", result["sanitized_text"])

    def test_physical_address_masking(self):
        text = "Ship order to 742 Evergreen Terrace for urgent delivery."
        result = self.engine.sanitize_text(text, session_id="test_sess_3")
        self.assertTrue(result["has_pii"])
        self.assertIn("<PII_ADDRESS_1>", result["sanitized_text"])
        self.assertNotIn("742 Evergreen Terrace", result["sanitized_text"])

    def test_customer_name_masking(self):
        text = "Order assigned to customer Robert Smith at Dallas warehouse."
        result = self.engine.sanitize_text(text, session_id="test_sess_4")
        self.assertTrue(result["has_pii"])
        self.assertIn("<PII_NAME_1>", result["sanitized_text"])
        self.assertNotIn("Robert Smith", result["sanitized_text"])

    def test_credit_card_masking(self):
        # Test card that passes Luhn
        text = "Billing payment card: 4532015112830366 for freight charges."
        result = self.engine.sanitize_text(text, session_id="test_sess_5")
        self.assertTrue(result["has_pii"])
        self.assertIn("<PII_CARD_1>", result["sanitized_text"])
        self.assertNotIn("4532015112830366", result["sanitized_text"])

    def test_clean_wms_query_no_false_positive(self):
        text = "Check ORD1001 for WH_ID WH01 with WAVE_NUM WV-2024-001 in Planned status."
        result = self.engine.sanitize_text(text, session_id="test_sess_6")
        self.assertFalse(result["has_pii"])
        self.assertEqual(result["sanitized_text"], text)

    def test_tabular_data_sanitization(self):
        rows = [
            {"ordnum": "ORD1001", "cust_name": "Jane Doe", "cust_email": "jane@example.com", "qty": 10},
            {"ordnum": "ORD1002", "cust_name": "Alice Johnson", "cust_email": "alice@test.org", "qty": 5},
        ]
        sanitized_rows, meta = self.engine.sanitize_tabular_data(rows, session_id="test_sess_7")
        self.assertTrue(meta["has_pii"])
        self.assertNotIn("Jane Doe", str(sanitized_rows))
        self.assertNotIn("jane@example.com", str(sanitized_rows))
        self.assertEqual(sanitized_rows[0]["ordnum"], "ORD1001")


if __name__ == "__main__":
    unittest.main()
