"""
Yonder Graph — Knowledge Enrichment Agent

AI-driven enrichment worker that evaluates new raw documents against
a 100-point confidence scoring rubric:
  - Schema Grounding in Oracle WMS Tables (35 pts)
  - Oracle SQL/MOCA AST Safety & Read-Only Check (25 pts)
  - Structural Metadata Completeness (20 pts)
  - Domain Alignment (20 pts)

Decision: >= 90% → Auto-Ingest into Neo4j; < 90% → Stage for SME review.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from backend.inference.llm_provider import LLMProviderFactory
from backend.governance.oracle_sql_validator import validate_oracle_sql
from backend.governance.safety_rules import MUTATION_TOKENS
from backend.database.neo4j_client import neo4j_client
from backend.audit.audit_logger import audit_logger
from backend.config import settings

logger = logging.getLogger(__name__)


class EnrichmentAgent:
    """
    AI-powered knowledge enrichment agent.
    
    Evaluates raw documents for quality, relevance, and safety before
    allowing them into the Neo4j knowledge graph.
    """

    def evaluate(
        self,
        filename: str,
        content: str,
        file_type: str = ".txt",
    ) -> Dict[str, Any]:
        """
        Evaluate a raw document against the 100-point confidence rubric.
        
        Args:
            filename: Name of the source file.
            content: Full text content of the file.
            file_type: File extension (.txt, .md, .json, .xlsx).
        
        Returns:
            Evaluation result with confidence score, breakdown, and extracted entities.
        """
        result = {
            "filename": filename,
            "file_type": file_type,
            "confidence_score": 0.0,
            "score_breakdown": {},
            "extracted_entities": [],
            "sql_validations": [],
            "warnings": [],
            "status": "evaluated",
        }

        # ── Score 1: Schema Grounding (35 pts) ──
        schema_score, _ = self._score_schema_grounding_detailed(content)
        result["score_breakdown"]["schema_grounding"] = schema_score

        # ── Score 2: SQL/MOCA Safety (25 pts) ──
        sql_score, sql_validations = self._score_sql_safety(content)
        result["score_breakdown"]["sql_safety"] = sql_score
        result["sql_validations"] = sql_validations

        # ── Score 3: Structural Metadata Completeness (20 pts) ──
        metadata_score = self._score_metadata_completeness(content, filename)
        result["score_breakdown"]["metadata_completeness"] = metadata_score

        # ── Score 4: Domain Alignment (20 pts) ──
        domain_score = self._score_domain_alignment(content)
        result["score_breakdown"]["domain_alignment"] = domain_score

        # ── Total Score ──
        total = schema_score + sql_score + metadata_score + domain_score
        result["confidence_score"] = round(total, 1)

        # ── Extract entities using LLM ──
        try:
            entities = self._extract_entities(content, filename)
            result["extracted_entities"] = entities
        except Exception as e:
            logger.warning("Entity extraction failed: %s", e)
            result["warnings"].append(f"Entity extraction failed: {e}")

        # ── Auto-ingest if >= threshold ──
        threshold = settings.auto_ingest_confidence_threshold
        if result["confidence_score"] >= threshold:
            result["decision"] = "AUTO_INGEST"
            try:
                self._ingest_to_neo4j(result)
                result["status"] = "ingested"
            except Exception as e:
                logger.error("Auto-ingest failed: %s", e)
                result["decision"] = "STAGE_FOR_REVIEW"
                result["status"] = "ingest_failed"
                result["warnings"].append(f"Ingest failed: {e}")
        else:
            result["decision"] = "STAGE_FOR_REVIEW"

        # Audit log
        audit_logger.log(
            session_id="enrichment",
            agent_name="EnrichmentAgent",
            action_type="ENRICHMENT_EVALUATION",
            input_payload={"filename": filename, "content_length": len(content)},
            output_payload=result,
            status="SUCCESS",
        )

        return result

    def evaluate_with_agentic_loop(
        self,
        filename: str,
        content: str,
        file_type: str = ".txt",
    ) -> Dict[str, Any]:
        """
        Execute full agentic evaluation and ingestion loop with step-by-step telemetry.
        """
        import time
        start_time = time.time()
        agentic_steps = []

        # Step 1: Parsing
        agentic_steps.append({
            "step_id": 1,
            "name": "Document Parsing & Text Extraction",
            "agent": "EnrichmentAgent:DocParser",
            "status": "COMPLETED",
            "details": f"Processed {file_type} document '{filename}' ({len(content)} chars, {len(content.split())} words).",
        })

        # Step 2: Schema Grounding
        schema_score, matched_tables = self._score_schema_grounding_detailed(content)
        agentic_steps.append({
            "step_id": 2,
            "name": "Schema Grounding & Table Mapping",
            "agent": "EnrichmentAgent:SchemaMatcher",
            "status": "COMPLETED",
            "details": f"Grounded {len(matched_tables)} Oracle WMS tables: {', '.join(matched_tables[:6]) if matched_tables else 'General Domain'}.",
            "score": f"{schema_score}/35 pts",
        })

        # Step 3: SQL Safety
        sql_score, sql_validations = self._score_sql_safety(content)
        agentic_steps.append({
            "step_id": 3,
            "name": "Tier 2 SQL/MOCA AST Security Validation",
            "agent": "GovernanceGuard:ASTValidator",
            "status": "COMPLETED" if all(v.get("is_valid") for v in sql_validations) else "WARNING",
            "details": f"Validated {len(sql_validations)} embedded SQL queries for read-only AST safety.",
            "score": f"{sql_score}/25 pts",
        })

        # Step 4: Metadata Completeness
        metadata_score = self._score_metadata_completeness(content, filename)
        agentic_steps.append({
            "step_id": 4,
            "name": "Structural Metadata Analysis",
            "agent": "EnrichmentAgent:MetadataScorer",
            "status": "COMPLETED",
            "details": "Evaluated SOP runbook structure, steps, parameters, and business keys.",
            "score": f"{metadata_score}/20 pts",
        })

        # Step 5: Domain Alignment
        domain_score = self._score_domain_alignment(content)
        agentic_steps.append({
            "step_id": 5,
            "name": "WMS Supply Chain Domain Alignment",
            "agent": "EnrichmentAgent:DomainClassifier",
            "status": "COMPLETED",
            "details": "Evaluated context against Inbound Receiving, Wave Allocation, and Inventory Tracking.",
            "score": f"{domain_score}/20 pts",
        })

        total = schema_score + sql_score + metadata_score + domain_score
        confidence_score = round(total, 1)

        # Step 6: Entity Extraction
        entities = []
        try:
            entities = self._extract_entities(content, filename)
            agentic_steps.append({
                "step_id": 6,
                "name": "AI Entity & Graph Relationship Extraction",
                "agent": "EnrichmentAgent:GraphExtractor",
                "status": "COMPLETED",
                "details": f"Extracted {len(entities)} graph nodes and taxonomy relations.",
            })
        except Exception as e:
            agentic_steps.append({
                "step_id": 6,
                "name": "AI Entity Extraction",
                "agent": "EnrichmentAgent:GraphExtractor",
                "status": "FAILED",
                "details": str(e),
            })

        # Step 7: Knowledge Graph Ingestion
        threshold = settings.auto_ingest_confidence_threshold
        decision = "AUTO_INGEST" if confidence_score >= threshold else "STAGE_FOR_REVIEW"
        ingest_status = "staged"

        if decision == "AUTO_INGEST":
            try:
                eval_payload = {
                    "filename": filename,
                    "confidence_score": confidence_score,
                    "extracted_entities": entities,
                }
                self._ingest_to_neo4j(eval_payload)
                ingest_status = "ingested"
                agentic_steps.append({
                    "step_id": 7,
                    "name": "Neo4j Knowledge Graph Ingestion",
                    "agent": "EnrichmentAgent:GraphMutator",
                    "status": "COMPLETED",
                    "details": f"Merged {len(entities)} knowledge nodes & domain edges into Neo4j graph.",
                })
            except Exception as e:
                decision = "STAGE_FOR_REVIEW"
                agentic_steps.append({
                    "step_id": 7,
                    "name": "Neo4j Graph Ingestion",
                    "agent": "EnrichmentAgent:GraphMutator",
                    "status": "FAILED",
                    "details": f"Ingestion fallback: Staged for SME review ({e}).",
                })
        else:
            agentic_steps.append({
                "step_id": 7,
                "name": "HITL SME Review Staging",
                "agent": "HITLService:StagingQueue",
                "status": "STAGED",
                "details": f"Confidence score ({confidence_score}%) is below auto-ingest threshold ({threshold}%). Staged for SME approval.",
            })

        duration_ms = round((time.time() - start_time) * 1000, 2)

        # Audit log
        audit_logger.log(
            session_id="enrichment-loop",
            agent_name="EnrichmentAgent",
            action_type="AGENTIC_DOCUMENT_INGESTION",
            input_payload={"filename": filename, "file_type": file_type, "content_len": len(content)},
            output_payload={"confidence_score": confidence_score, "decision": decision, "nodes_created": len(entities)},
            status="SUCCESS",
            execution_time_ms=duration_ms,
        )

        return {
            "filename": filename,
            "file_type": file_type,
            "confidence_score": confidence_score,
            "threshold": threshold,
            "decision": decision,
            "status": ingest_status,
            "score_breakdown": {
                "schema_grounding": schema_score,
                "sql_safety": sql_score,
                "metadata_completeness": metadata_score,
                "domain_alignment": domain_score,
            },
            "matched_tables": matched_tables,
            "extracted_entities": entities,
            "sql_validations": sql_validations,
            "agentic_steps": agentic_steps,
            "duration_ms": duration_ms,
        }

    def _score_schema_grounding_detailed(self, content: str) -> tuple:
        """Score schema grounding and return matched tables list. (35 pts)"""
        max_score = 35.0
        try:
            known_tables = list(neo4j_client.get_table_nodes())
        except Exception:
            known_tables = ["INBORD", "RCVTRK", "LOCMST", "INVDTL", "SHIPMENT", "WAVMST", "PALLET", "INVLOT"]

        if not known_tables:
            known_tables = ["INBORD", "RCVTRK", "LOCMST", "INVDTL", "SHIPMENT", "WAVMST", "PALLET"]

        content_upper = content.upper()
        matched = [table for table in known_tables if table.upper() in content_upper]

        if not matched:
            score = 0.0
        elif len(matched) <= 2:
            score = max_score * 0.4
        elif len(matched) <= 5:
            score = max_score * 0.7
        else:
            score = max_score * 0.95

        return round(score, 1), matched

    def _score_schema_grounding(self, content: str) -> float:
        """Score schema grounding — does the content reference known Oracle WMS tables? (35 pts)"""
        score, _ = self._score_schema_grounding_detailed(content)
        return score

    def _score_sql_safety(self, content: str) -> tuple:
        """Score SQL/MOCA safety — are embedded SQL statements read-only and valid? (25 pts)"""
        max_score = 25.0
        validations = []

        # Extract SQL-like blocks from content
        sql_blocks = self._extract_sql_blocks(content)

        if not sql_blocks:
            # No SQL found — give neutral score
            return max_score * 0.6, []

        valid_count = 0
        for sql in sql_blocks:
            result = validate_oracle_sql(sql)
            validations.append({
                "sql": sql[:200],
                "is_valid": result.is_valid,
                "errors": result.errors[:3],
                "flags": result.flags[:5],
            })
            if result.is_valid:
                valid_count += 1

        ratio = valid_count / len(sql_blocks) if sql_blocks else 0
        return round(max_score * ratio, 1), validations

    def _score_metadata_completeness(
        self, content: str, filename: str
    ) -> float:
        """Score structural metadata completeness. (20 pts)"""
        max_score = 20.0
        score = 0

        # Check for structural elements
        checks = [
            (bool(re.search(r"(?i)(sop|runbook|procedure)", content)), 3),
            (bool(re.search(r"(?i)(triage|diagnostic|troubleshoot)", content)), 3),
            (bool(re.search(r"(?i)(root cause|resolution|fix)", content)), 3),
            (bool(re.search(r"(?i)(select|from|where|join)", content)), 3),
            (bool(re.search(r"(?i)(ordnum|lodnum|wh_id|prtnum|dtlnum)", content)), 3),
            (len(content) > 200, 2),
            (len(content.split("\n")) > 5, 2),
            (bool(re.search(r"(?i)(step\s*\d|1\.|2\.|•|─)", content)), 1),
        ]

        for check, points in checks:
            if check:
                score += points

        return min(score, max_score)

    def _score_domain_alignment(self, content: str) -> float:
        """Score domain alignment — does content relate to WMS operations? (20 pts)"""
        max_score = 20.0
        content_lower = content.lower()

        wms_keywords = [
            "warehouse", "wms", "blue yonder", "inventory", "order",
            "shipment", "receiving", "inbound", "outbound", "allocation",
            "wave", "pick", "pack", "load", "trailer", "dock", "moca",
            "oracle", "supply chain", "logistics",
        ]

        matched = sum(1 for kw in wms_keywords if kw in content_lower)

        if matched == 0:
            return 0
        elif matched <= 3:
            return max_score * 0.4
        elif matched <= 7:
            return max_score * 0.7
        elif matched <= 12:
            return max_score * 0.85
        else:
            return max_score * 0.95

    def _extract_sql_blocks(self, content: str) -> List[str]:
        """Extract SQL statement blocks from raw text content."""
        sql_blocks = []

        # Pattern 1: Code-fenced SQL blocks
        fenced = re.findall(
            r"```(?:sql|oracle)?\s*\n(.*?)\n```",
            content,
            re.DOTALL | re.IGNORECASE,
        )
        sql_blocks.extend(fenced)

        # Pattern 2: Lines starting with SELECT/WITH
        lines = content.split("\n")
        current_block = []
        in_sql = False

        for line in lines:
            stripped = line.strip().upper()
            if stripped.startswith(("SELECT ", "WITH ")) and not in_sql:
                in_sql = True
                current_block = [line]
            elif in_sql:
                if stripped.endswith(";") or stripped == "" or stripped.startswith(("--", "#")):
                    current_block.append(line)
                    sql_blocks.append("\n".join(current_block).strip().rstrip(";"))
                    current_block = []
                    in_sql = False
                else:
                    current_block.append(line)

        if current_block:
            sql_blocks.append("\n".join(current_block).strip().rstrip(";"))

        return [s for s in sql_blocks if len(s.strip()) > 10]

    def _extract_entities(
        self, content: str, filename: str
    ) -> List[Dict[str, Any]]:
        """Use LLM to extract structured entities from raw content."""
        try:
            response = LLMProviderFactory.chat_completion(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a knowledge extraction agent for a WMS "
                            "knowledge graph. Extract structured entities from "
                            "the provided content. Return a JSON array of objects, "
                            "each with: type (SOPRunbook|BusinessTerm|Config), "
                            "name, domain (Inbound|Outbound|Inventory), "
                            "description, and any relevant properties."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"File: {filename}\n\nContent:\n{content[:4000]}",
                    },
                ],
                temperature=0.0,
                max_tokens=2048,
            )
            result_text = response.choices[0].message.content
            # Parse JSON from response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0]
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0]
            return json.loads(result_text.strip())
        except Exception as e:
            logger.warning("LLM entity extraction failed: %s", e)
            return []

    def _ingest_to_neo4j(self, evaluation: Dict[str, Any]) -> None:
        """Ingest extracted entities into Neo4j."""
        entities = evaluation.get("extracted_entities", [])
        for entity in entities:
            entity_type = entity.get("type", "KnowledgeNode")
            name = entity.get("name", "")
            if not name:
                continue

            domain = entity.get("domain", "general")
            description = entity.get("description", "")

            neo4j_client.execute_write(
                f"""
                MERGE (n:{entity_type} {{name: $name}})
                SET n.description = $description,
                    n.domain = $domain,
                    n.source = $source,
                    n.auto_ingested = true,
                    n.confidence_score = $score,
                    n.lastLoadedAt = datetime()
                WITH n
                MATCH (d:Domain {{name: $domain}})
                MERGE (n)-[:BELONGS_TO_DOMAIN]->(d)
                """,
                {
                    "name": name,
                    "description": description,
                    "domain": domain,
                    "source": evaluation.get("filename", ""),
                    "score": evaluation.get("confidence_score", 0),
                },
            )

        logger.info(
            "Ingested %d entities from %s",
            len(entities),
            evaluation.get("filename"),
        )


# Module-level singleton
enrichment_agent = EnrichmentAgent()
