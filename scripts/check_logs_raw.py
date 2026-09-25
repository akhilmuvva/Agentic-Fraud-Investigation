import os

patterns = [
    'Falling back to local cache',
    'Could not connect to TigerGraph',
    'TG_HOST not configured',
    'Operating in resilient local benchmark mode'
]

search_dirs = [
    'D:/hakern',
    'C:/Users/akhil/.gemini/antigravity/brain/1a97d13f-7884-4b42-8603-6c47b142a39a'
]

found = {}
for sdir in search_dirs:
    for root, dirs, files in os.walk(sdir):
        if any(skip in root for skip in ['.venv', '.git', 'node_modules']):
            continue
        for file in files:
            if file.endswith(('.log', '.txt', '.json', '.py')):
                # skip check scripts themselves
                if 'check_logs' in file:
                    continue
                fpath = os.path.join(root, file)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        for line_no, line in enumerate(f, 1):
                            for p in patterns:
                                if p.lower() in line.lower():
                                    found.setdefault(p, []).append((fpath, line_no, line.strip()))
                except Exception:
                    pass

for p in patterns:
    matches = found.get(p, [])
    print(f'=== Pattern: "{p}" (Total matches: {len(matches)}) ===')
    for fpath, lno, text in matches[:10]:
        print(f'  {fpath}:{lno}: {text}')
