"""Extract selected files from an Electron .asar archive.

Usage:
  py asar_extract.py <archive> <dest> [path-prefix ...]

Only files whose archive path starts with one of the given prefixes are written
(no prefix writes everything). Prints "path<TAB>size" per written file.
"""
import json
import struct
import sys
from pathlib import Path


def read_header(arch: Path):
    with arch.open("rb") as f:
        f.read(4)  # pickle size marker
        header_pickle_size = struct.unpack("<I", f.read(4))[0]
        json_size = struct.unpack("<I", f.read(4))[0]
        payload_size = struct.unpack("<I", f.read(4))[0]
        raw = f.read(payload_size)
        header = json.loads(raw.decode("utf-8"))
        return header, 16 + payload_size


def walk(node, prefix, out):
    for name, child in node.get("files", {}).items():
        p = f"{prefix}/{name}" if prefix else name
        if "files" in child:
            walk(child, p, out)
        else:
            out[p] = child


def main():
    arch = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    prefixes = sys.argv[3:]
    header, base = read_header(arch)
    files = {}
    walk(header, "", files)
    written = 0
    with arch.open("rb") as f:
        for path, meta in files.items():
            if prefixes and not any(path.startswith(p) for p in prefixes):
                continue
            if meta.get("unpacked"):
                continue
            offset = base + int(meta["offset"])
            size = int(meta["size"])
            target = dest / path.replace("/", "\\")
            target.parent.mkdir(parents=True, exist_ok=True)
            f.seek(offset)
            target.write_bytes(f.read(size))
            written += 1
            print(f"{path}\t{size}")
    print(f"matched {written} of {len(files)} archive files", file=sys.stderr)


main()
