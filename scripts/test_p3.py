import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_p3 = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY detect_card_not_present_new_device(
    STRING card_id,
    INT    lookback_days
) FOR GRAPH FraudInvestigation {
    TYPEDEF TUPLE<
        DOUBLE newness_score,
        STRING device_id,
        STRING transaction_id,
        FLOAT  transaction_amt,
        STRING product_cd,
        INT    prior_tx_count_on_card,
        STRING device_type,
        STRING device_info
    > CnpNewDeviceTuple;

    HeapAccum<CnpNewDeviceTuple>(10, newness_score DESC) @@flagged_results;

    SumAccum<INT> @@total_cnp_scanned = 0;
    SumAccum<INT> @@total_new_device  = 0;
    MaxAccum<INT> @@max_dt            = 0;

    Seed = {Card.*};
    TargetCard = SELECT c FROM Seed:c WHERE c.card_id == card_id;

    IF TargetCard.size() == 0 THEN
        PRINT "Card not found: " + card_id;
        RETURN;
    END;

    AllTxns = SELECT t FROM TargetCard:c -(USED_IN:e)-> Transaction:t
              ACCUM @@max_dt += t.TransactionDT;

    INT lookback_seconds = lookback_days * 86400;
    INT window_start     = @@max_dt - lookback_seconds;

    MapAccum<STRING, INT> @@device_tx_count;

    DevNodes = SELECT dv
        FROM AllTxns:t -(FROM_DEVICE:ed)-> Device:dv
        ACCUM @@device_tx_count += (dv.device_id -> 1);

    CnpWindowTxns = SELECT t
        FROM TargetCard:c -(USED_IN:e)-> Transaction:t
        WHERE t.TransactionDT >= window_start
            AND (t.ProductCD == "W" OR t.ProductCD == "H" OR t.ProductCD == "C" OR t.ProductCD == "S")
        ACCUM @@total_cnp_scanned += 1;

    Flagged = SELECT dv
        FROM CnpWindowTxns:t -(FROM_DEVICE:ed)-> Device:dv
        ACCUM
            INT total_cnt = 0,
            IF @@device_tx_count.containsKey(dv.device_id) THEN
                total_cnt = @@device_tx_count.get(dv.device_id)
            END,
            INT prior_cnt = 0,
            IF total_cnt > 1 THEN prior_cnt = total_cnt - 1 END,
            DOUBLE newness = 1.0,
            IF prior_cnt >= 10 THEN
                newness = 0.0
            ELSE
                newness = 1.0 - (prior_cnt * 0.1)
            END,
            IF prior_cnt < 2 THEN
                @@total_new_device += 1,
                @@flagged_results += CnpNewDeviceTuple(
                    newness,
                    dv.device_id,
                    t.transaction_id,
                    t.TransactionAmt,
                    t.ProductCD,
                    prior_cnt,
                    dv.DeviceType,
                    dv.DeviceInfo
                )
            END;

    PRINT card_id               AS queried_card_id;
    PRINT lookback_days         AS lookback_days_used;
    PRINT @@total_cnp_scanned   AS total_cnp_transactions_scanned;
    PRINT @@total_new_device    AS flagged_new_device_transactions;
    PRINT @@flagged_results     AS flagged_cnp_new_device_transactions;
}
"""

print(conn.gsql(test_p3))
