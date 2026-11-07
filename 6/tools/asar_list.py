"""List archive paths under a prefix (asar path lister)."""
import json
import struct
import sys
from pathlib import Path


def read_header(arch):
    with arch.open("rb") as f:
        f.read(4)
        struct.unpack("<I", f.read(4))[0]
        struct.unpack("<I", f.read(4))[0]
        payload = struct.unpack("<I", f.read(4))[0]
        return json.loads(f.read(payload).decode("utf-8")), 16 + payload


def walk(node, prefix, out):
    for name, child in node.get("files", {}).items():
        p = f"{prefix}/{name}" if prefix else name
        if "files" in child:
            walk(child, p, out)
        else:
            out.append((p, child.get("size", 0)))


arch = Path(sys.argv[1])
prefix = sys.argv[2] if len(sys.argv) > 2 else ""
header, _ = read_header(arch)
paths = []
walk(header, "", paths)
for p, size in paths:
    if p.startswith(prefix):
        print(f"{p}\t{size}")
