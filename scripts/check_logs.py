import glob
import os
import re

patterns = [
    'Falling back to local cache',
    'Could not connect to TigerGraph',
    'TG_HOST not configured',
    'Operating in resilient local benchmark mode'
]

log_files = glob.glob('D:/hakern/**/*.log', recursive=True) + glob.glob('C:/Users/akhil/.gemini/antigravity/brain/1a97d13f-7884-4b42-8603-6c47b142a39a/.system_generated/tasks/*.log')

print(f"Total log files searched: {len(log_files)}")
found_any = False
for lf in log_files:
    try:
        with open(lf, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for p in patterns:
                matches = re.findall(rf'.*{re.escape(p)}.*', content, re.IGNORECASE)
                if matches:
                    found_any = True
                    print(f"\n[MATCH] File: {lf}")
                    print(f"Pattern: '{p}' (Count: {len(matches)})")
                    for m in matches[:5]:
                        print("  >", m.strip())
    except Exception as e:
        pass

if not found_any:
    print("None of the specified strings were found in the log files.")
