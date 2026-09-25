import pyTigerGraph as tg

host = 'https://tg-897e2b8c-1409-41ba-97a5-d4b872e17b94.tg-2635877100.i.tgcloud.io'
secret = 'mkfs9m9uh7v3khau7b31p6dvd5r0v31o'
graph = 'FraudInvestigation'

conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

test_cmd = """
USE GRAPH FraudInvestigation
CREATE SCHEMA_CHANGE JOB add_schema FOR GRAPH FraudInvestigation {
    ADD VERTEX Customer (PRIMARY_ID customer_id STRING, addr1 STRING DEFAULT "", addr2 STRING DEFAULT "", P_emaildomain STRING DEFAULT "", risk_score FLOAT DEFAULT 0.0, first_seen DATETIME, last_seen DATETIME) WITH primary_id_as_attribute="TRUE";
}
RUN SCHEMA_CHANGE JOB add_schema
DROP JOB add_schema
"""

print(conn.gsql(test_cmd))
