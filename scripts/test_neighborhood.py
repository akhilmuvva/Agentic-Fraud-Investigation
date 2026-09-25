import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_neigh = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY get_suspicious_neighborhood(
    STRING transaction_id,
    INT    hops = 2
) FOR GRAPH FraudInvestigation {
    TYPEDEF TUPLE<
        STRING entity_type,
        STRING entity_id,
        INT    fraud_tx_count,
        INT    total_tx_count,
        DOUBLE fraud_ratio,
        DOUBLE risk_score,
        INT    hop_distance
    > NeighborTuple;

    ListAccum<NeighborTuple> @@neighborhood;
    SetAccum<STRING>         @@visited_ids;
    SumAccum<INT>            @@entity_count = 0;

    SumAccum<INT> @fraud_cnt = 0;
    SumAccum<INT> @total_cnt = 0;

    INT effective_hops = CASE WHEN hops > 3 THEN 3 ELSE hops END;
    IF effective_hops < 1 THEN effective_hops = 1; END;

    TxSeed = {Transaction.*};
    SeedTx = SELECT t FROM TxSeed:t WHERE t.transaction_id == transaction_id;

    IF SeedTx.size() == 0 THEN
        PRINT "Transaction not found: " + transaction_id;
        RETURN;
    END;

    @@visited_ids += transaction_id;

    T0 = SELECT t FROM SeedTx:t
         ACCUM
             INT self_fraud = CASE WHEN t.isFraud == 1 THEN 1 ELSE 0 END,
             DOUBLE risk = t.bank_risk_score,
             @@neighborhood += NeighborTuple(
                 "Transaction",
                 t.transaction_id,
                 self_fraud,
                 1,
                 self_fraud * 1.0,
                 risk,
                 0
             ),
             @@entity_count += 1;

    // Hop 1a: Device
    Hop1Devs = SELECT dv
               FROM SeedTx:t -(FROM_DEVICE:e)-> Device:dv;

    D1 = SELECT pt FROM Hop1Devs:dv -(DEVICE_USED_IN:e)-> Transaction:pt
         ACCUM
             dv.@total_cnt += 1,
             dv.@fraud_cnt += (CASE WHEN pt.isFraud == 1 THEN 1 ELSE 0 END);

    D2 = SELECT dv FROM Hop1Devs:dv
         ACCUM
             DOUBLE ratio = CASE WHEN dv.@total_cnt > 0 THEN (dv.@fraud_cnt * 1.0) / dv.@total_cnt ELSE 0.0 END,
             @@neighborhood += NeighborTuple(
                 "Device",
                 dv.device_id,
                 dv.@fraud_cnt,
                 dv.@total_cnt,
                 ratio,
                 ratio,
                 1
             ),
             @@visited_ids += dv.device_id,
             @@entity_count += 1;

    // Hop 1b: Card
    Hop1Cards = SELECT ca
                FROM SeedTx:t -(USED_BY_CARD:e)-> Card:ca;

    C1 = SELECT ct FROM Hop1Cards:c -(USED_IN:e)-> Transaction:ct
         ACCUM
             c.@total_cnt += 1,
             c.@fraud_cnt += (CASE WHEN ct.isFraud == 1 THEN 1 ELSE 0 END);

    C2 = SELECT c FROM Hop1Cards:c
         ACCUM
             DOUBLE ratio = CASE WHEN c.@total_cnt > 0 THEN (c.@fraud_cnt * 1.0) / c.@total_cnt ELSE 0.0 END,
             @@neighborhood += NeighborTuple(
                 "Card",
                 c.card_id,
                 c.@fraud_cnt,
                 c.@total_cnt,
                 ratio,
                 ratio,
                 1
             ),
             @@visited_ids += c.card_id,
             @@entity_count += 1;

    // Hop 2: Customer
    Hop2Customers = SELECT cu
                    FROM Hop1Cards:c -(OWNED_BY:e)-> Customer:cu;

    Cu1 = SELECT cu FROM Hop2Customers:cu
          ACCUM
              DOUBLE c_risk = cu.risk_score,
              @@neighborhood += NeighborTuple(
                  "Customer",
                  cu.customer_id,
                  0,
                  0,
                  0.0,
                  c_risk,
                  2
              ),
              @@visited_ids += cu.customer_id,
              @@entity_count += 1;

    PRINT transaction_id        AS queried_transaction_id;
    PRINT effective_hops        AS hops_explored;
    PRINT @@entity_count        AS total_entities_in_neighborhood;
    PRINT @@neighborhood        AS neighborhood_entities;
}
"""

print(conn.gsql(test_neigh))
