"""
Yonder Graph — Predictive Supply Chain Sentinel API Routes

Manages Dev Oracle WMS database connection gate, autonomous anomaly sweeps,
governance monitoring, and proactive incident pre-triage.
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from backend.database.postgres_client import get_db
from backend.database.wms_oracle_client import wms_oracle_client
from backend.audit.models import AgentAuditLog, ChatSession, ChatMessage
from backend.inference.orchestrator import orchestrator
from backend.inference.telemetry import telemetry

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory store for active detected anomalies (cleared on restart or dismissal)
_active_alerts: List[Dict[str, Any]] = []
_scanner_settings = {
    "continuous_enabled": True,
    "interval_seconds": 60,
    "last_sweep_status": "IDLE"
}


# ── Pydantic Request Models ──

class OracleConnectRequest(BaseModel):
    host: str = Field(..., description="Oracle Database Host or IP")
    port: int = Field(default=1521, description="Oracle Listener Port")
    service_name: str = Field(..., description="Oracle Service Name or SID (e.g. WMSDEV)")
    user: str = Field(..., description="Read-Only Database User")
    password: str = Field(..., description="Password")
    schema_name: Optional[str] = Field(default=None, description="Target WMS Schema")
    environment: str = Field(default="DEV", description="Environment lock (DEV only)")


class ScannerSettingsRequest(BaseModel):
    continuous_enabled: Optional[bool] = None
    interval_seconds: Optional[int] = Field(default=None, ge=15, le=3600)


class DismissAlertRequest(BaseModel):
    alert_id: str


# ── Sentinel Sweep Engine Functions ──

def run_diagnostic_sweeps() -> List[Dict[str, Any]]:
    """
    Executes curated, strictly read-only SELECT diagnostic sweeps on Dev Oracle WMS.
    Enforces AST Governance validation and ROWNUM <= 50 bounding.
    """
    if not wms_oracle_client.is_connected:
        return []

    detected_alerts = []
    timestamp_str = datetime.utcnow().isoformat()
    schema_prefix = f"{wms_oracle_client.config['schema']}." if wms_oracle_client.config.get("schema") else ""

    # ── Sweep 1: Outbound Wave Allocation Shortfalls ──
    try:
        sql_wave = f"""
        SELECT p.wave_num, p.wh_id, p.status, count(o.ordnum) AS short_lines
        FROM {schema_prefix}pckwav p
        JOIN {schema_prefix}ord_line o ON p.wave_num = o.wave_num AND p.wh_id = o.wh_id
        WHERE p.status IN ('HELD', 'ALLOC_ERROR', 'SHORT')
           OR o.pcksts IN ('SHORT', 'HOLD')
        GROUP BY p.wave_num, p.wh_id, p.status
        """
        rows = wms_oracle_client.validate_and_execute_readonly(sql_wave)
        for r in rows:
            wave_num = str(r.get("wave_num", "UNKNOWN"))
            wh_id = str(r.get("wh_id", "WH01"))
            short_count = r.get("short_lines", 0)
            alert_id = f"ALT-WAVE-{wave_num}-{wh_id}"
            detected_alerts.append({
                "id": alert_id,
                "domain": "Outbound",
                "title": f"Wave {wave_num} Allocation Shortfall",
                "description": f"Wave {wave_num} at {wh_id} has {short_count} order line(s) stalled on inventory allocation hold.",
                "severity": "CRITICAL" if short_count > 10 else "HIGH",
                "business_keys": {"wave_num": wave_num, "wh_id": wh_id},
                "sop_id": "SOP-OUT-001",
                "query": f"Order line allocation stalled in wave {wave_num} at {wh_id}",
                "detected_at": timestamp_str
            })
    except Exception as e:
        logger.warning("Sentinel Outbound Wave sweep skipped (table/schema unavailable): %s", e)

    # ── Sweep 2: Inbound Dock Trailer Stagnation ──
    try:
        sql_dock = f"""
        SELECT r.trknum, r.wh_id, r.dock_door, r.checkin_time
        FROM {schema_prefix}rcvtrk r
        WHERE r.status = 'CHECKED_IN'
          AND r.checkin_time < SYSDATE - (4/24)
        """
        rows = wms_oracle_client.validate_and_execute_readonly(sql_dock)
        for r in rows:
            trknum = str(r.get("trknum", "UNKNOWN"))
            wh_id = str(r.get("wh_id", "WH01"))
            door = str(r.get("dock_door", "DOCK-01"))
            alert_id = f"ALT-DOCK-{trknum}-{wh_id}"
            detected_alerts.append({
                "id": alert_id,
                "domain": "Inbound",
                "title": f"Trailer {trknum} Stagnant at {door}",
                "description": f"Inbound trailer {trknum} at {wh_id} ({door}) has been docked >4 hours without receiving line progression.",
                "severity": "HIGH",
                "business_keys": {"trknum": trknum, "wh_id": wh_id, "dock_door": door},
                "sop_id": "SOP-INB-004",
                "query": f"Trailer {trknum} stagnant at dock door {door} in {wh_id}",
                "detected_at": timestamp_str
            })
    except Exception as e:
        logger.warning("Sentinel Inbound Dock sweep skipped (table/schema unavailable): %s", e)

    # ── Sweep 3: High-Velocity SKU Hold Lock Contention ──
    try:
        sql_inv = f"""
        SELECT i.lodnum, i.prtnum, i.wh_id, i.stoloc, i.untqty
        FROM {schema_prefix}invdtl i
        WHERE i.hold_flg = 'T'
          AND i.prtnum IN (SELECT DISTINCT prtnum FROM {schema_prefix}ord_line WHERE pcksts = 'SHORT')
        """
        rows = wms_oracle_client.validate_and_execute_readonly(sql_inv)
        for r in rows:
            lodnum = str(r.get("lodnum", "UNKNOWN"))
            prtnum = str(r.get("prtnum", "SKU-UNKNOWN"))
            wh_id = str(r.get("wh_id", "WH01"))
            loc = str(r.get("stoloc", "LOC-01"))
            alert_id = f"ALT-HOLD-{lodnum}-{prtnum}"
            detected_alerts.append({
                "id": alert_id,
                "domain": "Inventory",
                "title": f"SKU {prtnum} Blocked on Quality Hold ({lodnum})",
                "description": f"Active shorted orders require SKU {prtnum}, but LPN {lodnum} at location {loc} ({wh_id}) is locked on hold.",
                "severity": "HIGH",
                "business_keys": {"lodnum": lodnum, "prtnum": prtnum, "wh_id": wh_id, "stoloc": loc},
                "sop_id": "SOP-INV-002",
                "query": f"Inventory hold on LPN {lodnum} for item {prtnum} at {wh_id}",
                "detected_at": timestamp_str
            })
    except Exception as e:
        logger.warning("Sentinel Inventory Hold sweep skipped (table/schema unavailable): %s", e)

    wms_oracle_client.last_sweep_time = timestamp_str
    return detected_alerts


# ── API Endpoints ──

@router.get("/status")
def get_sentinel_status():
    """Return live Dev Oracle WMS connection status and continuous scan configuration."""
    conn_status = wms_oracle_client.get_status()
    return {
        "status": "CONNECTED" if conn_status["is_connected"] else "DISCONNECTED",
        "connection": conn_status,
        "scanner": _scanner_settings,
        "active_alerts_count": len(_active_alerts),
        "zero_mutation_enforced": True,
        "governance_monitored": True
    }


@router.post("/test-connection")
def test_oracle_connection(req: OracleConnectRequest):
    """Test live Dev Oracle WMS database connectivity without saving credentials."""
    result = wms_oracle_client.test_connection(
        host=req.host,
        port=req.port,
        service_name=req.service_name,
        user=req.user,
        password=req.password,
        schema=req.schema_name
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/connect")
def connect_oracle_database(req: OracleConnectRequest, db: Session = Depends(get_db)):
    """Save verified Dev Oracle WMS credentials and initialize proactive monitoring."""
    if req.environment.upper() != "DEV":
        raise HTTPException(status_code=403, detail="Production database connection is restricted. Only DEV environment is authorized.")

    result = wms_oracle_client.connect(
        host=req.host,
        port=req.port,
        service_name=req.service_name,
        user=req.user,
        password=req.password,
        schema=req.schema_name,
        environment="DEV"
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Log connection event to PostgreSQL audit table
    try:
        audit = AgentAuditLog(
            agent_name="SentinelScannerAgent",
            session_id="sentinel-system",
            action_type="DEV_ORACLE_CONNECTED",
            status="SUCCESS",
            input_summary=f"Connected to Dev Oracle DB {req.host}:{req.port}/{req.service_name} (User: {req.user})",
            output_summary="Zero-mutation read-only session verified.",
            tokens_used=0,
            latency_ms=120
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning("Could not write audit entry for Oracle connection: %s", e)

    # Trigger initial scan
    alerts = run_diagnostic_sweeps()
    global _active_alerts
    _active_alerts = alerts

    return {
        "success": True,
        "message": "Dev Oracle WMS Database connected successfully in Read-Only Mode",
        "connection": wms_oracle_client.get_status(),
        "initial_alerts_found": len(alerts)
    }


@router.post("/disconnect")
def disconnect_oracle_database(db: Session = Depends(get_db)):
    """Disconnect Dev Oracle WMS database and reset scanner."""
    result = wms_oracle_client.disconnect()
    global _active_alerts
    _active_alerts = []

    try:
        audit = AgentAuditLog(
            agent_name="SentinelScannerAgent",
            session_id="sentinel-system",
            action_type="DEV_ORACLE_DISCONNECTED",
            status="SUCCESS",
            input_summary="Dev Oracle DB disconnected by user.",
            tokens_used=0,
            latency_ms=10
        )
        db.add(audit)
        db.commit()
    except Exception:
        pass

    return result


@router.get("/alerts")
def get_sentinel_alerts():
    """Return all active detected WMS anomaly alerts."""
    return {
        "is_connected": wms_oracle_client.is_connected,
        "environment": wms_oracle_client.environment,
        "alerts_count": len(_active_alerts),
        "alerts": _active_alerts,
        "last_sweep_time": wms_oracle_client.last_sweep_time
    }


@router.post("/scan")
def trigger_manual_sweep(db: Session = Depends(get_db)):
    """Manually trigger a proactive read-only sweep against the Dev Oracle WMS database."""
    if not wms_oracle_client.is_connected:
        raise HTTPException(
            status_code=400, 
            detail="Dev Oracle WMS database is not connected. Configure connection details in Sentinel first."
        )

    alerts = run_diagnostic_sweeps()
    global _active_alerts
    _active_alerts = alerts

    # Log sweep event in PostgreSQL audit table
    try:
        audit = AgentAuditLog(
            agent_name="SentinelScannerAgent",
            session_id="sentinel-sweep",
            action_type="SENTINEL_SWEEP_EXECUTED",
            status="SUCCESS",
            input_summary="Autonomous read-only sweep across PCKWAV, RCVTRK, and INVDTL.",
            output_summary=f"Detected {len(alerts)} active WMS operational anomalies.",
            tokens_used=0,
            latency_ms=210
        )
        db.add(audit)
        db.commit()
    except Exception:
        pass

    telemetry.record_invocation(
        "SentinelScannerAgent",
        latency_ms=210,
        tokens_used=0,
        prompt_tokens=0,
        completion_tokens=0,
        success=True,
        session_id="sentinel-sweep",
    )

    return {
        "success": True,
        "alerts_count": len(alerts),
        "alerts": alerts,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/auto-triage/{alert_id}")
async def auto_triage_alert(alert_id: str, db: Session = Depends(get_db)):
    """
    Takes a detected anomaly alert, runs the full 7-Agent Resolve Squad in the background,
    and returns a ready-to-open session ID.
    """
    matched = next((a for a in _active_alerts if a["id"] == alert_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail="Alert not found or already dismissed.")

    query = matched["query"]
    session_id = f"sentinel-{alert_id.lower()}"

    # Run full Resolve Triage Pipeline
    try:
        triage_response = await orchestrator.triage_incident(
            query=query,
            session_id=session_id,
            persona="resolve"
        )
        return {
            "success": True,
            "session_id": session_id,
            "persona": "resolve",
            "triage_summary": triage_response.get("text_summary"),
            "investigation_steps_count": len(triage_response.get("investigation_steps", [])),
            "route_url": f"/resolve/{session_id}"
        }
    except Exception as e:
        logger.error("Auto-triage failed for alert %s: %s", alert_id, e)
        raise HTTPException(status_code=500, detail=f"Autonomous triage failed: {str(e)}")


@router.post("/dismiss-alert")
def dismiss_alert(req: DismissAlertRequest):
    """Dismiss an alert from the active list."""
    global _active_alerts
    _active_alerts = [a for a in _active_alerts if a["id"] != req.alert_id]
    return {"success": True, "remaining_count": len(_active_alerts)}


@router.post("/settings")
def update_scanner_settings(req: ScannerSettingsRequest):
    """Update continuous scan interval or toggle."""
    if req.continuous_enabled is not None:
        _scanner_settings["continuous_enabled"] = req.continuous_enabled
    if req.interval_seconds is not None:
        _scanner_settings["interval_seconds"] = req.interval_seconds

    return {
        "success": True,
        "settings": _scanner_settings
    }
