"""
Yonder Graph — Executive ROI & Temporal Cost Savings Reporting API

Provides endpoints to aggregate and generate reports on:
  - Daily, monthly, and yearly incident MTTR acceleration
  - Engineering cost savings ($USD)
  - Carrier SLA penalty risk avoidances ($USD)
  - Domain-level distribution (Inbound, Outbound, Inventory)
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.database.postgres_client import get_db
from backend.audit.models import ExecutiveRoiMetric

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports & Executive ROI"])


@router.get("/roi/summary")
def get_roi_summary(
    year: Optional[int] = Query(None, description="Filter by year (e.g. 2026)"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    domain: Optional[str] = Query(None, description="Filter by domain (Inbound, Outbound, Inventory)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Generate aggregated executive ROI metrics grouped by year, month, day, and domain.
    """
    query = db.query(ExecutiveRoiMetric)

    if year is not None:
        query = query.filter(ExecutiveRoiMetric.year == year)
    if month is not None:
        query = query.filter(ExecutiveRoiMetric.month == month)
    if domain:
        query = query.filter(func.lower(ExecutiveRoiMetric.domain) == domain.lower())

    records: List[ExecutiveRoiMetric] = query.all()
    total_count = len(records)

    if total_count == 0:
        return {
            "total_incidents": 0,
            "total_estimated_roi_usd": 0.0,
            "total_engineering_cost_saved_usd": 0.0,
            "total_carrier_sla_penalty_avoided_usd": 0.0,
            "total_manual_hours_avoided": 0.0,
            "avg_mttr_reduction_pct": 0.0,
            "by_year": [],
            "by_month": [],
            "by_day": [],
            "by_domain": {},
        }

    total_roi = sum(r.total_estimated_roi_usd for r in records)
    total_eng = sum(r.engineering_cost_saved_usd for r in records)
    total_sla = sum(r.carrier_sla_penalty_avoided_usd for r in records)
    total_manual_sec = sum(r.manual_mttr_sec - r.automated_mttr_sec for r in records)
    total_manual_hours = round(total_manual_sec / 3600.0, 1)
    avg_reduction = round(sum(r.mttr_reduction_pct for r in records) / total_count, 1)

    # ── Group by Year ──
    year_map = {}
    for r in records:
        y = r.year
        if y not in year_map:
            year_map[y] = {"year": y, "incidents": 0, "roi_usd": 0.0, "eng_saved_usd": 0.0, "sla_avoided_usd": 0.0}
        year_map[y]["incidents"] += 1
        year_map[y]["roi_usd"] = round(year_map[y]["roi_usd"] + r.total_estimated_roi_usd, 2)
        year_map[y]["eng_saved_usd"] = round(year_map[y]["eng_saved_usd"] + r.engineering_cost_saved_usd, 2)
        year_map[y]["sla_avoided_usd"] = round(year_map[y]["sla_avoided_usd"] + r.carrier_sla_penalty_avoided_usd, 2)

    # ── Group by Month (Year-Month) ──
    month_map = {}
    for r in records:
        key = f"{r.year}-{r.month:02d}"
        if key not in month_map:
            month_map[key] = {"year": r.year, "month": r.month, "period": key, "incidents": 0, "roi_usd": 0.0}
        month_map[key]["incidents"] += 1
        month_map[key]["roi_usd"] = round(month_map[key]["roi_usd"] + r.total_estimated_roi_usd, 2)

    # ── Group by Day (Year-Month-Day) ──
    day_map = {}
    for r in records:
        key = f"{r.year}-{r.month:02d}-{r.day:02d}"
        if key not in day_map:
            day_map[key] = {"year": r.year, "month": r.month, "day": r.day, "date": key, "incidents": 0, "roi_usd": 0.0}
        day_map[key]["incidents"] += 1
        day_map[key]["roi_usd"] = round(day_map[key]["roi_usd"] + r.total_estimated_roi_usd, 2)

    # ── Group by Domain ──
    domain_map = {}
    for r in records:
        d = r.domain or "General"
        if d not in domain_map:
            domain_map[d] = {"domain": d, "incidents": 0, "roi_usd": 0.0}
        domain_map[d]["incidents"] += 1
        domain_map[d]["roi_usd"] = round(domain_map[d]["roi_usd"] + r.total_estimated_roi_usd, 2)

    return {
        "total_incidents": total_count,
        "total_estimated_roi_usd": round(total_roi, 2),
        "total_engineering_cost_saved_usd": round(total_eng, 2),
        "total_carrier_sla_penalty_avoided_usd": round(total_sla, 2),
        "total_manual_hours_avoided": total_manual_hours,
        "avg_mttr_reduction_pct": avg_reduction,
        "by_year": sorted(list(year_map.values()), key=lambda x: x["year"]),
        "by_month": sorted(list(month_map.values()), key=lambda x: x["period"]),
        "by_day": sorted(list(day_map.values()), key=lambda x: x["date"]),
        "by_domain": domain_map,
    }


@router.get("/roi/records")
def get_roi_records(
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, description="Filter by month"),
    day: Optional[int] = Query(None, description="Filter by day"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Retrieve paginated incident ROI log records for exporting/reporting.
    """
    query = db.query(ExecutiveRoiMetric)

    if year is not None:
        query = query.filter(ExecutiveRoiMetric.year == year)
    if month is not None:
        query = query.filter(ExecutiveRoiMetric.month == month)
    if day is not None:
        query = query.filter(ExecutiveRoiMetric.day == day)
    if domain:
        query = query.filter(func.lower(ExecutiveRoiMetric.domain) == domain.lower())

    total = query.count()
    records = (
        query.order_by(desc(ExecutiveRoiMetric.timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [r.to_dict() for r in records],
    }
