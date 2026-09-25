import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_p4 = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY detect_out_of_region_use(
    STRING card_id,
    STRING transaction_id
) FOR GRAPH FraudInvestigation {
    TYPEDEF TUPLE<
        STRING addr1,
        INT    tx_count,
        DOUBLE frequency_pct
    > AddrFreqTuple;

    HeapAccum<AddrFreqTuple>(50, tx_count DESC) @@addr_distribution;
    MapAccum<STRING, INT> @@addr_count_map;

    SumAccum<INT>    @@total_hist_tx    = 0;
    SumAccum<DOUBLE> @@anomaly_score    = 0.0;
    SumAccum<STRING> @@flagged_addr     = "";
    SumAccum<DOUBLE> @@flagged_freq_pct = 0.0;
    OrAccum          @@is_out_of_region = FALSE;
    MaxAccum<INT>    @@max_dt           = 0;

    Seed = {Card.*};
    TargetCard = SELECT c FROM Seed:c WHERE c.card_id == card_id;

    IF TargetCard.size() == 0 THEN
        PRINT "Card not found: " + card_id;
        RETURN;
    END;

    TxSeed = {Transaction.*};
    FlaggedTx = SELECT t FROM TxSeed:t WHERE t.transaction_id == transaction_id;

    IF FlaggedTx.size() == 0 THEN
        PRINT "Transaction not found: " + transaction_id;
        RETURN;
    END;

    STRING flagged_addr1 = "";
    T1 = SELECT t FROM FlaggedTx:t ACCUM @@flagged_addr += t.addr1;
    flagged_addr1 = @@flagged_addr;

    INT window_90_days = 90 * 86400;

    T2 = SELECT t FROM TargetCard:c -(USED_IN:e)-> Transaction:t
         ACCUM @@max_dt += t.TransactionDT;

    INT window_start = @@max_dt - window_90_days;

    HistTxns = SELECT t
               FROM TargetCard:c -(USED_IN:e)-> Transaction:t
               WHERE t.TransactionDT >= window_start
                     AND t.transaction_id != transaction_id
                     AND t.addr1 != ""
               ACCUM
                   @@addr_count_map += (t.addr1 -> 1),
                   @@total_hist_tx  += 1;

    DOUBLE total_f = @@total_hist_tx * 1.0;

    IF @@total_hist_tx == 0 THEN
        @@anomaly_score += 1.0;
        @@is_out_of_region = TRUE;
        @@flagged_freq_pct += 0.0;
    ELSE
        FOREACH (addr, cnt) IN @@addr_count_map DO
            DOUBLE pct = (cnt * 100.0) / total_f;
            @@addr_distribution += AddrFreqTuple(addr, cnt, pct);
        END;

        DOUBLE f_pct = 0.0;
        IF @@addr_count_map.containsKey(flagged_addr1) THEN
            f_pct = (@@addr_count_map.get(flagged_addr1) * 100.0) / total_f;
        END;
        @@flagged_freq_pct += f_pct;

        IF f_pct < 5.0 THEN
            @@is_out_of_region = TRUE;
            DOUBLE raw_score = 1.0 - (f_pct / 5.0);
            @@anomaly_score += CASE WHEN raw_score > 1.0 THEN 1.0 ELSE raw_score END;
        END;
    END;

    PRINT card_id               AS queried_card_id;
    PRINT transaction_id        AS queried_transaction_id;
    PRINT flagged_addr1         AS flagged_addr1;
    PRINT @@flagged_freq_pct    AS flagged_addr_historical_frequency_pct;
    PRINT @@is_out_of_region    AS is_out_of_region;
    PRINT @@anomaly_score       AS anomaly_score;
    PRINT @@total_hist_tx       AS historical_transaction_count_90d;
    PRINT @@addr_distribution   AS historical_addr_distribution;
}
"""

print(conn.gsql(test_p4))
