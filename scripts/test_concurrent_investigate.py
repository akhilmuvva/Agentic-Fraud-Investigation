import asyncio
import httpx
import json
import time

URL = "http://127.0.0.1:8000"

PAYLOADS = [
    {
        "case_id": "TEST-CONC-001",
        "trigger_type": "risk_score",
        "trigger_text": "Model scored txn 3514030 at 0.61",
        "flagged_txn_id": "3514030",
        "card_id": "C12382-K1",
        "customer_id": "C12382",
        "risk_score": 0.61
    },
    {
        "case_id": "TEST-CONC-002",
        "trigger_type": "customer_report",
        "trigger_text": "Customer disputed $292.36 online purchase 3478782",
        "flagged_txn_id": "3478782",
        "card_id": "C11891-K1",
        "customer_id": "C11891",
        "risk_score": 0.89
    },
    {
        "case_id": "TEST-CONC-003",
        "trigger_type": "analyst_request",
        "trigger_text": "Analyst flagged out of region spike on 3478784",
        "flagged_txn_id": "3478784",
        "card_id": "C08623-K2",
        "customer_id": "C08623",
        "risk_score": 0.75
    }
]

async def call_investigate(client: httpx.AsyncClient, payload: dict):
    t0 = time.time()
    resp = await client.post(f"{URL}/investigate", json=payload, timeout=60.0)
    dur = time.time() - t0
    return payload["case_id"], resp.status_code, resp.json(), dur

async def main():
    print(f"Firing 3 concurrent POST /investigate requests to {URL}/investigate...")
    async with httpx.AsyncClient() as client:
        tasks = [call_investigate(client, p) for p in PAYLOADS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    print("\n--- Concurrent Execution Responses ---")
    for r in results:
        if isinstance(r, Exception):
            print("Request Exception:", r)
        else:
            cid, status, data, dur = r
            print(f"Case {cid}: Status {status} in {dur:.2f}s -> outcome={data.get('outcome')}, confidence={data.get('confidence')}, actions={data.get('recommended_actions')}")

    print("\n--- Verifying cases_store integrity via GET /cases/{id} ---")
    async with httpx.AsyncClient() as client:
        for p in PAYLOADS:
            cid = p["case_id"]
            resp = await client.get(f"{URL}/cases/{cid}")
            if resp.status_code == 200:
                cdata = resp.json()
                print(f"Case {cid}: Verified in store! Outcome={cdata.get('outcome')}, FlaggedTxn={cdata.get('flagged_txn_id')}, CardID={cdata.get('card_id')}")
            else:
                print(f"Case {cid}: FAILED status {resp.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
