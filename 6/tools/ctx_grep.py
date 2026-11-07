"""Print short context windows around regex matches in a (possibly huge, one-line) file."""
import re
import sys

path, pattern = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 220
limit = int(sys.argv[4]) if len(sys.argv) > 4 else 12
text = open(path, encoding="utf-8", errors="replace").read()
count = 0
for match in re.finditer(pattern, text):
    start = max(0, match.start() - width)
    end = min(len(text), match.end() + width)
    print(f"@{match.start()}: ...{text[start:end]}...")
    print("-" * 60)
    count += 1
    if count >= limit:
        break
print(f"[{count} matches shown]", file=sys.stderr)
