import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_p2 = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY detect_account_takeover(
    STRING customer_id,
    INT    lookback_days
) FOR GRAPH FraudInvestigation {
    TYPEDEF TUPLE<
        DOUBLE risk_score,
        STRING transaction_id,
        FLOAT  TransactionAmt,
        STRING device_id,
        BOOL   new_device_flag,
        BOOL   email_change_flag,
        BOOL   name_mismatch_flag,
        BOOL   amount_spike_flag,
        STRING r_emaildomain,
        STRING historical_r_emaildomain,
        FLOAT  historical_avg_amt
    > AtoTuple;

    HeapAccum<AtoTuple>(10, risk_score DESC) @@suspicious_txns;

    SumAccum<FLOAT> @@hist_amt_total = 0.0;
    SumAccum<INT>   @@hist_tx_count  = 0;
    MapAccum<STRING, INT> @@email_freq;
    MaxAccum<INT>   @@max_dt         = 0;
    SumAccum<INT>   @@alert_count    = 0;

    Seed = {Customer.*};
    TargetCustomer = SELECT cu FROM Seed:cu WHERE cu.customer_id == customer_id;

    IF TargetCustomer.size() == 0 THEN
        PRINT "Customer not found: " + customer_id;
        RETURN;
    END;

    AllCards = SELECT ca FROM TargetCustomer:cu -(OWNS:e1)-> Card:ca;

    INT lookback_seconds = lookback_days * 86400;

    AllTxns = SELECT t FROM AllCards:ca -(USED_IN:e2)-> Transaction:t
              ACCUM @@max_dt += t.TransactionDT;

    INT window_start  = @@max_dt - lookback_seconds;
    INT recent_cutoff = @@max_dt - (30 * 86400);

    HistTxns = SELECT t FROM AllCards:ca -(USED_IN:e2)-> Transaction:t
               WHERE t.TransactionDT < recent_cutoff
               ACCUM
                   @@hist_amt_total += t.TransactionAmt,
                   @@hist_tx_count  += 1,
                   @@email_freq     += (t.R_emaildomain -> 1);

    FLOAT hist_avg = CASE
                         WHEN @@hist_tx_count > 0 THEN @@hist_amt_total / @@hist_tx_count
                         ELSE 0.0
                     END;

    MaxAccum<INT> @@max_email_freq = 0;
    STRING hist_email_mode = "";
    FOREACH (domain, cnt) IN @@email_freq DO
        IF cnt > @@max_email_freq THEN
            @@max_email_freq = cnt;
            hist_email_mode = domain;
        END;
    END;

    RecentTxns = SELECT t FROM AllCards:ca -(USED_IN:e2)-> Transaction:t
        WHERE t.TransactionDT >= recent_cutoff AND t.TransactionDT >= window_start
        ACCUM
            BOOL email_change = (t.R_emaildomain != hist_email_mode AND hist_email_mode != ""),
            BOOL name_mismatch = (t.M4 != "M"),
            BOOL amount_spike = (hist_avg > 0.0 AND t.TransactionAmt > (2.0 * hist_avg)),
            BOOL new_device = (t.M7 != "T"),

            DOUBLE risk = 0.0,
            IF new_device    THEN risk = risk + 0.35 END,
            IF email_change  THEN risk = risk + 0.25 END,
            IF name_mismatch THEN risk = risk + 0.20 END,
            IF amount_spike  THEN risk = risk + 0.20 END,

            IF risk > 0.0 THEN
                @@suspicious_txns += AtoTuple(
                    CASE WHEN risk > 1.0 THEN 1.0 ELSE risk END,
                    t.transaction_id,
                    t.TransactionAmt,
                    t.M7,
                    new_device,
                    email_change,
                    name_mismatch,
                    amount_spike,
                    t.R_emaildomain,
                    hist_email_mode,
                    hist_avg
                ),
                @@alert_count += 1
            END;

    PRINT customer_id           AS queried_customer_id;
    PRINT lookback_days         AS lookback_days_used;
    PRINT @@hist_tx_count       AS historical_baseline_tx_count;
    PRINT hist_avg              AS historical_average_amount;
    PRINT hist_email_mode       AS historical_r_emaildomain_mode;
    PRINT @@alert_count         AS suspicious_recent_transactions;
    PRINT @@suspicious_txns     AS suspicious_transactions;
}
"""
print(conn.gsql(test_p2))
