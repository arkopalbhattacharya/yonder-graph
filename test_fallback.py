from backend.inference.orchestrator import orchestrator

query = "how can i check for an order status in the database"
try:
    res = orchestrator._generate_fallback_sql(query, "Outbound", "test_session")
    print(res)
except Exception as e:
    print("ERROR:", e)
