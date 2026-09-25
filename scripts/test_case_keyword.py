import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')

conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_cmd = """
USE GRAPH FraudInvestigation
CREATE SCHEMA_CHANGE JOB test_card FOR GRAPH FraudInvestigation {
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
}
DROP JOB test_card
"""
print(conn.gsql(test_cmd))
