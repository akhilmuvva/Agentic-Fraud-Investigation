import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_p5 = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY detect_card_testing(
    STRING card_id,
    INT    window_hours
) FOR GRAPH FraudInvestigation {
    TYPEDEF TUPLE<
        STRING transaction_id,
        FLOAT  amount,
        INT    transaction_dt,
        STRING product_cd,
        FLOAT  c2_count
    > TxnTuple;

    ListAccum<TxnTuple> @@low_value_txns;
    ListAccum<TxnTuple> @@high_value_txns;

    MaxAccum<INT>   @@max_dt               = 0;
    MinAccum<INT>   @@first_low_dt         = 2147483647;
    MaxAccum<INT>   @@last_low_dt          = 0;
    MinAccum<INT>   @@first_high_dt        = 2147483647;
    MaxAccum<FLOAT> @@max_c2               = 0.0;
    SumAccum<INT>   @@low_value_count      = 0;
    SumAccum<INT>   @@high_value_count     = 0;
    OrAccum         @@card_testing_flagged = FALSE;

    Seed = {Card.*};
    TargetCard = SELECT c FROM Seed:c WHERE c.card_id == card_id;

    IF TargetCard.size() == 0 THEN
        PRINT "Card not found: " + card_id;
        RETURN;
    END;

    T1 = SELECT t
         FROM TargetCard:c -(USED_IN:e)-> Transaction:t
         ACCUM @@max_dt += t.TransactionDT;

    INT window_seconds = window_hours * 3600;
    INT window_start   = @@max_dt - window_seconds;

    WindowTxns = SELECT t
        FROM TargetCard:c -(USED_IN:e)-> Transaction:t
        WHERE t.TransactionDT >= window_start
        ACCUM
            @@max_c2 += t.C2,

            IF t.TransactionAmt < 10.0 THEN
                @@low_value_txns += TxnTuple(
                    t.transaction_id,
                    t.TransactionAmt,
                    t.TransactionDT,
                    t.ProductCD,
                    t.C2
                ),
                @@low_value_count += 1,
                @@first_low_dt    += t.TransactionDT,
                @@last_low_dt     += t.TransactionDT
            ELSE IF t.TransactionAmt > 100.0 THEN
                @@high_value_txns += TxnTuple(
                    t.transaction_id,
                    t.TransactionAmt,
                    t.TransactionDT,
                    t.ProductCD,
                    t.C2
                ),
                @@high_value_count += 1,
                @@first_high_dt    += t.TransactionDT
            END;

    DOUBLE time_gap_minutes = 0.0;
    FLOAT  ring_size        = 0.0;

    IF @@low_value_count > 0 AND @@high_value_count > 0 THEN
        IF @@first_high_dt > @@first_low_dt THEN
            @@card_testing_flagged = TRUE;
            time_gap_minutes = (@@first_high_dt - @@first_low_dt) / 60.0;
        END;
    END;

    IF @@max_c2 > 3.0 THEN
        ring_size = @@max_c2;
    END;

    STRING primary_high_id = "";
    FLOAT  primary_high_amt = 0.0;

    FOREACH ht IN @@high_value_txns DO
        IF ht.transaction_dt == @@first_high_dt THEN
            primary_high_id  = ht.transaction_id;
            primary_high_amt = ht.amount;
        END;
    END;

    PRINT card_id                   AS queried_card_id;
    PRINT window_hours              AS window_hours_used;
    PRINT @@card_testing_flagged    AS card_testing_pattern_matched;
    PRINT @@low_value_count         AS probe_transactions_count;
    PRINT @@high_value_count        AS exploitation_transactions_count;
    PRINT time_gap_minutes          AS probe_to_exploitation_gap_minutes;
    PRINT ring_size                 AS fraud_ring_size_indicator;
    PRINT primary_high_id           AS primary_exploitation_txn_id;
    PRINT primary_high_amt          AS primary_exploitation_amount;
    PRINT @@low_value_txns          AS low_value_probe_transactions;
    PRINT @@high_value_txns         AS high_value_exploitation_transactions;
}
"""

print(conn.gsql(test_p5))
