"""
agent/nodes/investigate.py
--------------------------
LangGraph node: investigate_node

Hydrates the ``entities`` dict in CaseState by fetching the flagged
transaction, the customer profile, the card profile, and the last 20
card transactions from TigerGraph. All results are appended to the
evidence audit trail.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from agent import tg_client
from agent.state import CaseState

logger = logging.getLogger(__name__)


def investigate_node(state: CaseState) -> CaseState:
    """
    Hydrate entity data for the flagged case from TigerGraph.

    Tool calls performed (in order)
    ---------------------------------
    1. ``get_transaction(flagged_txn_id)``
    2. ``get_customer(customer_id)``
    3. ``get_card(card_id)``
    4. ``get_card_transactions(card_id, limit=20)``

    Each call appends a structured entry to ``state["evidence"]`` with::

        {
            "step": "investigate",
            "timestamp": str,
            "tool": "<function_name>",
            "params": dict,
            "result_summary": str,     # human-readable 1-liner
            "raw": dict | list         # full result for downstream nodes
        }

    The ``state["entities"]`` dict is populated with the merged results::

        {
            "customer": dict,
            "card": dict,
            "transaction": dict,
            "card_history": list[dict]
        }

    Parameters
    ----------
    state : CaseState
        Current graph state.

    Returns
    -------
    CaseState
        Updated state with ``entities`` and extended ``evidence``.
    """
    flagged_txn_id: str = state.get("flagged_txn_id", "")
    customer_id: str = state.get("customer_id", "")
    card_id: str = state.get("card_id", "")
    case_id: str = state.get("case_id", "")

    logger.info(
        "[investigate_node] case_id=%s txn=%s customer=%s card=%s",
        case_id, flagged_txn_id, customer_id, card_id,
    )

    evidence = list(state.get("evidence", []))
    entities: dict = dict(state.get("entities", {}))

    # ── 1. Fetch transaction ───────────────────────────────────────────────
    txn = tg_client.get_transaction(flagged_txn_id)
    evidence.append(
        {
            "step": "investigate",
            "timestamp": _utc_now(),
            "tool": "get_transaction",
            "params": {"tx_id": flagged_txn_id},
            "result_summary": (
                f"Transaction {flagged_txn_id}: "
                f"amount={txn.get('TransactionAmt', txn.get('amount', 'N/A'))}, "
                f"product_cd={txn.get('ProductCD', txn.get('product_cd', 'N/A'))}, "
                f"found={'yes' if txn and 'error' not in txn else 'no'}"
            ),
            "raw": txn,
        }
    )
    entities["transaction"] = txn

    # ── 2. Fetch customer ─────────────────────────────────────────────────
    customer = tg_client.get_customer(customer_id)
    evidence.append(
        {
            "step": "investigate",
            "timestamp": _utc_now(),
            "tool": "get_customer",
            "params": {"customer_id": customer_id},
            "result_summary": (
                f"Customer {customer_id}: "
                f"addr_state={customer.get('addr1', customer.get('addr_state', 'N/A'))}, "
                f"email_domain={customer.get('P_emaildomain', customer.get('email_domain', 'N/A'))}, "
                f"found={'yes' if customer and 'error' not in customer else 'no'}"
            ),
            "raw": customer,
        }
    )
    entities["customer"] = customer

    # ── 3. Fetch card ─────────────────────────────────────────────────────
    card = tg_client.get_card(card_id)
    evidence.append(
        {
            "step": "investigate",
            "timestamp": _utc_now(),
            "tool": "get_card",
            "params": {"card_id": card_id},
            "result_summary": (
                f"Card {card_id}: "
                f"type={card.get('card4', card.get('card_type', 'N/A'))}, "
                f"bank={card.get('card3', card.get('issuing_bank', 'N/A'))}, "
                f"found={'yes' if card and 'error' not in card else 'no'}"
            ),
            "raw": card,
        }
    )
    entities["card"] = card

    # ── 4. Fetch recent card transactions ─────────────────────────────────
    card_history = tg_client.get_card_transactions(card_id, limit=20)
    amounts = [
        float(t.get("TransactionAmt", t.get("amount", 0))) for t in card_history
    ]
    avg_amt = sum(amounts) / len(amounts) if amounts else 0.0
    evidence.append(
        {
            "step": "investigate",
            "timestamp": _utc_now(),
            "tool": "get_card_transactions",
            "params": {"card_id": card_id, "limit": 20},
            "result_summary": (
                f"Retrieved {len(card_history)} recent transactions for card {card_id}. "
                f"Average amount: ${avg_amt:.2f}. "
                f"Most recent txn_id: "
                f"{card_history[0].get('v_id', 'N/A') if card_history else 'N/A'}"
            ),
            "raw": card_history,
        }
    )
    entities["card_history"] = card_history

    # ── Assemble updated state ────────────────────────────────────────────
    updated = dict(state)
    updated["entities"] = entities
    updated["evidence"] = evidence

    logger.info(
        "[investigate_node] hydration complete – %d evidence entries total",
        len(evidence),
    )
    return updated  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()
