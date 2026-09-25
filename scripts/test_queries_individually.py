import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('D:/hakern/.env')
import pyTigerGraph as tg

host = os.getenv('TG_HOST')
graph = os.getenv('TG_GRAPH', 'FraudInvestigation')
secret = os.getenv('TG_SECRET')

conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

queries = [
    ('p1_card_not_present_fraud.gsql', Path('D:/hakern/gsql/patterns/p1_card_not_present_fraud.gsql')),
    ('p2_account_takeover.gsql', Path('D:/hakern/gsql/patterns/p2_account_takeover.gsql')),
    ('p3_card_not_present_new_device.gsql', Path('D:/hakern/gsql/patterns/p3_card_not_present_new_device.gsql')),
    ('p4_out_of_region_use.gsql', Path('D:/hakern/gsql/patterns/p4_out_of_region_use.gsql')),
    ('p5_card_testing.gsql', Path('D:/hakern/gsql/patterns/p5_card_testing.gsql')),
    ('suspicious_neighborhood.gsql', Path('D:/hakern/gsql/queries/suspicious_neighborhood.gsql')),
    ('get_card_transactions.gsql', Path('D:/hakern/gsql/queries/get_card_transactions.gsql')),
]

for name, path in queries:
    print(f"\n==================== {name} ====================")
    content = path.read_text(encoding='utf-8')
    lines = [l for l in content.splitlines() if not l.strip().startswith('INSTALL QUERY')]
    clean_gsql = "\n".join(lines)
    try:
        res = conn.gsql(f"USE GRAPH {graph}\n{clean_gsql}")
        print(res.strip())
    except Exception as e:
        print(f"Exception: {e}")
