import pyTigerGraph as tg

host = 'https://tg-897e2b8c-1409-41ba-97a5-d4b872e17b94.tg-2635877100.i.tgcloud.io'
secret = 'mkfs9m9uh7v3khau7b31p6dvd5r0v31o'
graph = 'Transaction_Fraud'

conn = tg.TigerGraphConnection(host=host, graphname=graph, gsqlSecret=secret, tgCloud=True)
conn.getToken(secret)

print('--- Installed Queries ---')
try:
    print(conn.getInstalledQueries())
except Exception as e:
    print('Error:', e)

print('--- Vertex Types ---')
try:
    print(conn.getVertexTypes())
except Exception as e:
    print('Error:', e)

print('--- GSQL LS ---')
try:
    print(conn.gsql('ls'))
except Exception as e:
    print('Error:', e)
