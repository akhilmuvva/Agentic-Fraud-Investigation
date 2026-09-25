import os
import sys
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')

print(f"Connecting to {host} on graph {graph}...")
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

schema_job = """
USE GRAPH FraudInvestigation

CREATE SCHEMA_CHANGE JOB add_full_schema FOR GRAPH FraudInvestigation {
    ADD VERTEX Card (
        PRIMARY_ID card_id       STRING,
        customer_id              STRING DEFAULT "",
        card1                    STRING DEFAULT "",
        card2                    STRING DEFAULT "",
        card3                    STRING DEFAULT "",
        card4                    STRING DEFAULT "",
        card5                    STRING DEFAULT "",
        card6                    STRING DEFAULT ""
    ) WITH primary_id_as_attribute="TRUE";

    ADD VERTEX Transaction (
        PRIMARY_ID transaction_id STRING,
        TransactionDT             INT    DEFAULT 0,
        TransactionAmt            FLOAT  DEFAULT 0.0,
        ProductCD                 STRING DEFAULT "",
        dist1                     FLOAT  DEFAULT 0.0,
        dist2                     FLOAT  DEFAULT 0.0,
        P_emaildomain             STRING DEFAULT "",
        R_emaildomain             STRING DEFAULT "",
        bank_risk_score           FLOAT  DEFAULT 0.0,
        M1                        STRING DEFAULT "",
        M2                        STRING DEFAULT "",
        M3                        STRING DEFAULT "",
        M4                        STRING DEFAULT "",
        M5                        STRING DEFAULT "",
        M6                        STRING DEFAULT "",
        M7                        STRING DEFAULT "",
        M8                        STRING DEFAULT "",
        M9                        STRING DEFAULT "",
        C1                        FLOAT  DEFAULT 0.0,
        C2                        FLOAT  DEFAULT 0.0,
        C6                        FLOAT  DEFAULT 0.0,
        C13                       FLOAT  DEFAULT 0.0,
        C14                       FLOAT  DEFAULT 0.0,
        isFraud                   INT    DEFAULT 0,
        addr1                     STRING DEFAULT "",
        addr2                     STRING DEFAULT ""
    ) WITH primary_id_as_attribute="TRUE";

    ADD VERTEX Device (
        PRIMARY_ID device_id  STRING,
        DeviceType            STRING DEFAULT "",
        DeviceInfo            STRING DEFAULT "",
        os                    STRING DEFAULT "",
        browser               STRING DEFAULT ""
    ) WITH primary_id_as_attribute="TRUE";

    ADD VERTEX Cases (
        PRIMARY_ID case_id          STRING,
        trigger_type                STRING DEFAULT "",
        trigger_text                STRING DEFAULT "",
        status                      STRING DEFAULT "open",
        outcome                     STRING DEFAULT "",
        pattern_matched             STRING DEFAULT "",
        confidence_score            FLOAT  DEFAULT 0.0,
        investigation_json          STRING DEFAULT "",
        summary_text                STRING DEFAULT "",
        summary_embedding           LIST<DOUBLE>,
        next_action_before          STRING DEFAULT "",
        next_action_after           STRING DEFAULT "",
        exposure_usd                FLOAT  DEFAULT 0.0,
        sar_required                INT    DEFAULT 0,
        created_at                  DATETIME,
        updated_at                  DATETIME
    ) WITH primary_id_as_attribute="TRUE";

    ADD VERTEX FraudPattern (
        PRIMARY_ID pattern_id   STRING,
        pattern_name            STRING DEFAULT "",
        description             STRING DEFAULT "",
        gsql_query              STRING DEFAULT ""
    ) WITH primary_id_as_attribute="TRUE";

    ADD VERTEX PolicyClause (
        PRIMARY_ID clause_id    STRING,
        clause_text             STRING DEFAULT "",
        action_required         STRING DEFAULT "",
        threshold               FLOAT  DEFAULT 0.0,
        clause_embedding        LIST<DOUBLE>
    ) WITH primary_id_as_attribute="TRUE";

    ADD DIRECTED EDGE OWNS (
        FROM Customer, TO Card
    ) WITH REVERSE_EDGE="OWNED_BY";

    ADD DIRECTED EDGE USED_IN (
        FROM Card, TO Transaction,
        transaction_dt INT DEFAULT 0
    ) WITH REVERSE_EDGE="USED_BY_CARD";

    ADD DIRECTED EDGE FROM_DEVICE (
        FROM Transaction, TO Device
    ) WITH REVERSE_EDGE="DEVICE_USED_IN";

    ADD DIRECTED EDGE INVOLVED_IN (
        FROM Customer, TO Cases
    ) WITH REVERSE_EDGE="CASE_INVOLVES_CUSTOMER";

    ADD DIRECTED EDGE INVOLVES_TX (
        FROM Cases, TO Transaction
    ) WITH REVERSE_EDGE="TX_IN_CASE";

    ADD DIRECTED EDGE CITES_PATTERN (
        FROM Cases, TO FraudPattern
    ) WITH REVERSE_EDGE="PATTERN_CITED_BY";

    ADD DIRECTED EDGE CITES_CLAUSE (
        FROM Cases, TO PolicyClause
    ) WITH REVERSE_EDGE="CLAUSE_CITED_BY";

    ADD DIRECTED EDGE MATCHED_BY (
        FROM Transaction, TO FraudPattern,
        match_score FLOAT DEFAULT 0.0
    ) WITH REVERSE_EDGE="PATTERN_MATCHES_TX";
}
RUN SCHEMA_CHANGE JOB add_full_schema
DROP JOB add_full_schema
"""

print("Executing schema deployment...")
resp = conn.gsql(schema_job)
print(resp)
