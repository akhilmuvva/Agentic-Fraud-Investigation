import json
import logging
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.nodes.assess_uncertainty import assess_uncertainty_node

logging.basicConfig(level=logging.INFO)

# Load two cases from cases/
with open('cases/HHG-001.json') as f:
    c1_raw = json.load(f)
with open('cases/HHG-002.json') as f:
    c2_raw = json.load(f)

# Convert to state format
state1 = {
    'case_id': 'HHG-001',
    'trigger_type': 'risk_score',
    'risk_score': 0.61,
    'pattern_matches': [{'pattern_id': 'card_not_present_fraud', 'matched': True, 'risk_indicators': ['mismatch']}],
    'evidence': c1_raw.get('case', {}).get('evidence', []),
    'similar_cases': [],
    'policy_hits': [],
    'loop_count': 0
}

state2 = {
    'case_id': 'HHG-002',
    'trigger_type': 'risk_score',
    'risk_score': 0.89,
    'pattern_matches': [{'pattern_id': 'card_not_present_new_device', 'matched': True, 'risk_indicators': ['first_seen_device', 'amount_spike']}],
    'evidence': c2_raw.get('case', {}).get('evidence', []),
    'similar_cases': [],
    'policy_hits': [],
    'loop_count': 0
}

print('=== Running Case 1 Run 1 ===')
res1_a = assess_uncertainty_node(dict(state1))
ev1_a = res1_a.get('evidence', [])[-1]
print('Case 1 Run 1 Confidence:', res1_a.get('confidence'))
print('Case 1 Run 1 Needs More:', res1_a.get('_needs_more_evidence'))
print('Case 1 Run 1 Raw LLM snippet:', str(ev1_a.get('llm_raw', ''))[:120])
print('Case 1 Run 1 Reasoning:', ev1_a.get('reasoning'))

print('\n=== Running Case 1 Run 2 ===')
res1_b = assess_uncertainty_node(dict(state1))
ev1_b = res1_b.get('evidence', [])[-1]
print('Case 1 Run 2 Confidence:', res1_b.get('confidence'))
print('Case 1 Run 2 Needs More:', res1_b.get('_needs_more_evidence'))
print('Case 1 Run 2 Raw LLM snippet:', str(ev1_b.get('llm_raw', ''))[:120])
print('Case 1 Run 2 Reasoning:', ev1_b.get('reasoning'))

print('\n=== Running Case 2 Run 1 ===')
res2 = assess_uncertainty_node(dict(state2))
ev2 = res2.get('evidence', [])[-1]
print('Case 2 Run 1 Confidence:', res2.get('confidence'))
print('Case 2 Run 1 Needs More:', res2.get('_needs_more_evidence'))
print('Case 2 Run 1 Raw LLM snippet:', str(ev2.get('llm_raw', ''))[:120])
print('Case 2 Run 1 Reasoning:', ev2.get('reasoning'))
