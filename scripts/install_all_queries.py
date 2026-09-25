import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')

print(f"Connecting to TigerGraph Savanna at {host} (graph: {graph})...")
conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

query_files = [
    Path('D:/hakern/gsql/patterns/p1_card_not_present_fraud.gsql'),
    Path('D:/hakern/gsql/patterns/p2_account_takeover.gsql'),
    Path('D:/hakern/gsql/patterns/p3_card_not_present_new_device.gsql'),
    Path('D:/hakern/gsql/patterns/p4_out_of_region_use.gsql'),
    Path('D:/hakern/gsql/patterns/p5_card_testing.gsql'),
    Path('D:/hakern/gsql/queries/suspicious_neighborhood.gsql'),
    Path('D:/hakern/gsql/queries/get_card_transactions.gsql'),
    Path('D:/hakern/gsql/queries/find_similar_cases.gsql'),
]

for qf in query_files:
    print(f"\n--- Adding Query from {qf.name} ---")
    content = qf.read_text(encoding='utf-8')
    # strip INSTALL QUERY from file so we can compile all in one batch
    lines = [l for l in content.splitlines() if not l.strip().startswith('INSTALL QUERY')]
    clean_gsql = "\n".join(lines)
    res = conn.gsql(f"USE GRAPH {graph}\n{clean_gsql}")
    print(res)

print("\n--- Installing All Queries (INSTALL QUERY ALL) ---")
install_res = conn.gsql(f"USE GRAPH {graph}\nINSTALL QUERY ALL")
print(install_res)

print("\n--- Verifying Installed Queries via conn.getInstalledQueries() ---")
installed = conn.getInstalledQueries()
print("conn.getInstalledQueries() raw result:")
import pprint
pprint.pprint(installed)
