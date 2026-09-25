import os
from dotenv import load_dotenv
load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

print(f"Running INSTALL QUERY ALL on {graph}...")
res = conn.gsql(f"USE GRAPH {graph}\nINSTALL QUERY ALL")
print("INSTALL QUERY Output:")
print(res)

print("\n--- conn.getInstalledQueries() ---")
installed = conn.getInstalledQueries()
import pprint
pprint.pprint(installed)
