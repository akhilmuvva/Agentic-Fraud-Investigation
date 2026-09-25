import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_gct = """
USE GRAPH FraudInvestigation

CREATE OR REPLACE QUERY get_card_transactions(
    STRING card_id,
    INT max_limit = 50
) FOR GRAPH FraudInvestigation {
    Start = {Card.*};
    TargetCard = SELECT c FROM Start:c WHERE c.card_id == card_id;

    Txns = SELECT t FROM TargetCard:c -(USED_IN:e)-> Transaction:t
           ORDER BY t.TransactionDT DESC
           LIMIT max_limit;

    PRINT Txns AS transactions;
}
"""

print(conn.gsql(test_gct))
