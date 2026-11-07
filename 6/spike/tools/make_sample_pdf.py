#!/usr/bin/env python3
"""
Generate a small, fully offline test PDF + a JSON manifest for the paper-reader spike.

The sample deliberately exercises the pdf.js 6.3.289 code paths that matter for a
faithful reader:

  page 1  Helvetica / Helvetica-Bold   (non-embedded base-14 fonts -> standard_fonts/)
          + a FlateDecode RGB image     (image fidelity)
          + filled vector rectangles    (vector fidelity)
  page 2  Times-Roman / Helvetica-Oblique, NBSP / curly quotes / space runs and a
          wrapped paragraph             (text extraction + NFC + whitespace normalisation)
  page 3  Type0 CID font, Encoding /UniGB-UCS2-H, no embedded font file
                                        (forces cmaps/UniGB-UCS2-H.bcmap fetch)
  page 4  /Rotate 90 + JPEG2000 image   (rotation math + wasm/openjpeg.wasm)

No third-party PDF tooling is used to write the file; it is written byte by byte.
Pillow is only used to *make* the JPEG2000 test image (test fixture generator only,
never a runtime dependency of the spike).

Usage:  py spike/tools/make_sample_pdf.py
Writes: spike/sample/sample.pdf, spike/sample/manifest.json
"""

import io
import json
import os
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.abspath(os.path.join(HERE, "..", "sample"))

PAGE_W, PAGE_H = 612, 792  # US Letter, PDF user units


# --------------------------------------------------------------------------- #
# tiny PDF writer
# --------------------------------------------------------------------------- #
class PdfWriter:
    def __init__(self):
        self.objs = {}  # object number -> bytes body (without "N 0 obj"/"endobj")

    def stream_obj(self, num, dictionary, data):
        """Write a stream object; /Length is always added as a direct integer."""
        body = (
            b"<< "
            + dictionary
            + b" /Length "
            + str(len(data)).encode("ascii")
            + b" >>\nstream\n"
            + data
            + b"\nendstream"
        )
        self.objs[num] = body

    def obj(self, num, body):
        self.objs[num] = body

    def build(self, root_num):
        out = io.BytesIO()
        out.write(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
        offsets = {}
        for num in sorted(self.objs):
            offsets[num] = out.tell()
            out.write(b"%d 0 obj\n" % num)
            out.write(self.objs[num])
            out.write(b"\nendobj\n")
        xref_pos = out.tell()
        max_num = max(self.objs)
        out.write(b"xref\n0 %d\n" % (max_num + 1))
        out.write(b"0000000000 65535 f \n")
        for num in range(1, max_num + 1):
            if num in offsets:
                out.write(b"%010d 00000 n \n" % offsets[num])
            else:
                out.write(b"0000000000 65535 f \n")
        out.write(
            b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (max_num + 1, root_num, xref_pos)
        )
        return out.getvalue()


def flate(data):
    return zlib.compress(data, 9)


ESCAPES = {
    "\xa0": "\\240",  # NBSP          (WinAnsi 0xA0)
    "\u2018": "\\221",  # left single quote   (0x91)
    "\u2019": "\\222",  # right single quote  (0x92)
    "\u201c": "\\223",  # left double quote   (0x93)
    "\u201d": "\\224",  # right double quote  (0x94)
    "\u2013": "\\226",  # en dash             (0x96)
    "\u2014": "\\227",  # em dash             (0x97)
}


def pdf_literal(text):
    """Encode a Python str as a PDF literal string for an 8-bit WinAnsi font."""
    out = []
    for ch in text:
        if ch in ESCAPES:
            out.append(ESCAPES[ch])
        elif ch == "\\":
            out.append("\\\\")
        elif ch == "(":
            out.append("\\(")
        elif ch == ")":
            out.append("\\)")
        else:
            out.append(ch)
    return "(" + "".join(out) + ")"


def rgb_gradient(width, height, step=4, base_b=128):
    """Raw RGB bytes for a gradient: R = x*step, G = y*step, B = base_b."""
    raw = bytearray()
    for y in range(height):
        for x in range(width):
            raw.extend(((x * step) % 256, (y * step) % 256, base_b))
    return bytes(raw), ((width // 2) * step) % 256, ((height // 2) * step) % 256, base_b


def jpx_codestream(width, height):
    """JPEG2000 codestream for a gradient, via Pillow (fixture generation only)."""
    from PIL import Image

    img = Image.new("RGB", (width, height))
    px = img.load()
    for y in range(height):
        for x in range(width):
            px[x, y] = (int(255 * x / max(1, width - 1)), int(255 * y / max(1, height - 1)), 90)
    buf = io.BytesIO()
    img.save(buf, format="JPEG2000", irreversible=True)
    centre = list(px[width // 2, height // 2])
    return buf.getvalue(), centre


# --------------------------------------------------------------------------- #
# page content streams
# --------------------------------------------------------------------------- #
def content_page1():
    lines = [
        ("F2", 20, 72, 718, "Paper Reader Spike"),
        ("F2", 12, 72, 690, "Faithful layout, text layer, selection and highlights"),
        ("F1", 11, 72, 664, "This page uses the non-embedded base-14 fonts Helvetica and"),
        ("F1", 11, 72, 648, "Helvetica-Bold, resolved by pdf.js through standard_fonts/."),
        ("F1", 11, 72, 632, "The bar below is vector art; the square is a FlateDecode RGB image."),
        ("F1", 11, 72, 616, "Both must be painted by page.render() with no loss."),
    ]
    parts = [
        b"q 0.16 0.32 0.62 rg 72 560 468 26 re f Q",
        b"q 0.95 0.62 0.15 rg 72 528 468 8 re f Q",
        b"q 128 0 0 128 72 430 cm /Im1 Do Q",
        b"q 0.2 g 72 410 468 2 re f Q",
    ]
    for font, size, x, y, text in lines:
        parts.append(
            ("BT /%s %d Tf %.1f %.1f Td %s Tj ET" % (font, size, x, y, pdf_literal(text))).encode("latin-1")
        )
    return b"\n".join(parts)


def content_page2():
    parts = [
        b"BT /F3 16 Tf 72 726 Td "
        + pdf_literal("Text extraction and normalisation").encode("latin-1")
        + b" Tj ET"
    ]
    paragraphs = [
        "The reader must keep a faithful visual copy of the page. Selection is resolved from",
        "the rendered text layer, so the DOM spans have to line up with canvas pixels.",
        "Whitespace   runs, a non-breaking\u00a0space, \u2018curly quotes\u2019, \u201cdouble\u201d quotes and",
        "an en dash \u2013 all appear on this page so normalised search can be exercised.",
        "Whitespace   collapsing must not change the stored item indexes.",
        "The quick brown fox jumps over the lazy dog. 0123456789.",
        "Highlight persistence is stored as normalised page-space rectangles.",
    ]
    y = 690
    for line in paragraphs:
        parts.append(("BT /F3 11 Tf 72 %d Td %s Tj ET" % (y, pdf_literal(line))).encode("latin-1"))
        y -= 22
    parts.append(
        ("BT /F4 11 Tf 72 %d Td %s Tj ET" % (y - 10, pdf_literal("Oblique line for font fidelity"))).encode("latin-1")
    )
    return b"\n".join(parts)


def content_page3(hex_cjk):
    # IMPORTANT: a Type0 font with a predefined CMap (UniGB-UCS2-H) interprets
    # *string* operands as 2-byte CIDs, so ASCII text must NOT be shown with
    # /F5 — it would be read as bogus CIDs. Only the hex string below (real
    # UTF-16BE code units) goes through the CID font.
    return b"\n".join([
        b"BT /F1 14 Tf 72 700 Td "
        + pdf_literal("CJK text (Type0 / UniGB-UCS2-H, no embedded font file):").encode("latin-1")
        + b" Tj ET",
        b"BT /F5 22 Tf 72 660 Td <" + hex_cjk + b"> Tj ET",
        b"BT /F1 11 Tf 72 620 Td "
        + pdf_literal("The line above must be extractable even though the font is not embedded.").encode("latin-1")
        + b" Tj ET",
    ])


def content_page4():
    return b"\n".join([
        b"BT /F2 16 Tf 72 726 Td " + pdf_literal("Rotated page (/Rotate 90)").encode("latin-1") + b" Tj ET",
        b"BT /F1 11 Tf 72 700 Td "
        + pdf_literal("Rotation is applied by the viewport; the text layer stays in raw PDF space.").encode("latin-1")
        + b" Tj ET",
        b"BT /F1 11 Tf 72 684 Td "
        + pdf_literal("Selection rectangles on this page must still map back to the page box.").encode("latin-1")
        + b" Tj ET",
        b"q 160 0 0 160 72 470 cm /Im2 Do Q",
        b"BT /F1 11 Tf 72 440 Td "
        + pdf_literal("Above: JPEG2000 image decoded by wasm/openjpeg.wasm.").encode("latin-1")
        + b" Tj ET",
    ])


# --------------------------------------------------------------------------- #
# assemble
# --------------------------------------------------------------------------- #
def build():
    w = PdfWriter()
    catalog, pages = 1, 2
    page_objs = {1: 3, 2: 4, 3: 5, 4: 6}
    content_objs = {1: 7, 2: 8, 3: 9, 4: 10}
    fonts = {"F1": 11, "F2": 12, "F3": 13, "F4": 14, "F5": 15}
    cid_descendant, cid_descriptor = 16, 17
    im1, im2 = 18, 19

    # --- images ------------------------------------------------------------ #
    W1 = H1 = 64
    rgb_bytes, r_centre, g_centre, b_centre = rgb_gradient(W1, H1)
    w.stream_obj(
        im1,
        b"/Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB "
        b"/BitsPerComponent 8 /Filter /FlateDecode" % (W1, H1),
        flate(rgb_bytes),
    )

    W2 = H2 = 160
    jpx_bytes, jpx_centre = jpx_codestream(W2, H2)
    w.stream_obj(
        im2,
        b"/Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB "
        b"/BitsPerComponent 8 /Filter /JPXDecode" % (W2, H2),
        jpx_bytes,
    )

    # --- fonts ------------------------------------------------------------- #
    base14 = {"F1": "Helvetica", "F2": "Helvetica-Bold", "F3": "Times-Roman", "F4": "Helvetica-Oblique"}
    for key, num in fonts.items():
        if key in base14:
            w.obj(
                num,
                b"<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding /WinAnsiEncoding >>"
                % base14[key].encode("ascii"),
            )

    cjk_text = "\u4e2d\u6587\u68c0\u7d22\u6d4b\u8bd5\u8de8\u8bed\u8a00\u6392\u7248"
    hex_cjk = "".join("%04X" % ord(c) for c in cjk_text).encode("ascii")

    w.obj(
        fonts["F5"],
        b"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H "
        b"/DescendantFonts [%d 0 R] >>" % cid_descendant,
    )
    w.obj(
        cid_descendant,
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light "
        b"/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> "
        b"/FontDescriptor %d 0 R /DW 1000 >>" % cid_descriptor,
    )
    w.obj(
        cid_descriptor,
        b"<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 "
        b"/FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 "
        b"/CapHeight 880 /StemV 80 >>",
    )

    # --- content streams --------------------------------------------------- #
    for page_no, fn in ((1, content_page1), (2, content_page2), (3, lambda: content_page3(hex_cjk)),
                        (4, content_page4)):
        data = fn()
        w.stream_obj(content_objs[page_no], b"/Filter /FlateDecode", flate(data))

    # --- page tree --------------------------------------------------------- #
    res_common = (
        b"/Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R /F4 %d 0 R /F5 %d 0 R >> "
        b"/XObject << /Im1 %d 0 R /Im2 %d 0 R >>"
        % (fonts["F1"], fonts["F2"], fonts["F3"], fonts["F4"], fonts["F5"], im1, im2)
    )
    for page_no, num in page_objs.items():
        rotate = b" /Rotate 90" if page_no == 4 else b""
        w.obj(
            num,
            b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %d %d]%s /Resources << %s >> "
            b"/Contents %d 0 R >>" % (pages, PAGE_W, PAGE_H, rotate, res_common, content_objs[page_no]),
        )
    w.obj(
        pages,
        b"<< /Type /Pages /Kids ["
        + b" ".join(b"%d 0 R" % page_objs[i] for i in sorted(page_objs))
        + b"] /Count 4 >>",
    )
    w.obj(catalog, b"<< /Type /Catalog /Pages %d 0 R >>" % pages)

    pdf_bytes = w.build(catalog)

    manifest = {
        "file": "sample.pdf",
        "pdfjsVersion": "6.3.289",
        "pageWidthPt": PAGE_W,
        "pageHeightPt": PAGE_H,
        "numPages": 4,
        "pages": [
            {
                "page": 1,
                "rotate": 0,
                "texts": ["Paper Reader Spike", "Helvetica-Bold", "FlateDecode RGB image"],
                "fontPx": {"Paper Reader Spike": 20},
                "images": [{"pdfRect": [72, 430, 200, 558], "expectedRgb": [r_centre, g_centre, b_centre]}],
            },
            {"page": 2, "rotate": 0, "texts": ["Text extraction and normalisation", "non-breaking", "en dash"]},
            {"page": 3, "rotate": 0, "texts": ["CJK text", cjk_text]},
            {
                "page": 4,
                "rotate": 90,
                "texts": ["Rotated page", "JPEG2000"],
                "images": [{"pdfRect": [72, 470, 232, 630], "expectedRgb": jpx_centre}],
            },
        ],
        "searchSamples": [
            {"query": "Paper Reader Spike", "page": 1},
            {"query": "text extraction", "page": 2},
            {"query": "cjk text", "page": 3},
            {"query": "jpeg2000 image", "page": 4},
            {"query": "whitespace collapsing", "page": 2},
            {"query": "non-breaking space", "page": 2},
        ],
        "selectionSample": {"page": 1, "needle": "Faithful layout"},
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    pdf_path = os.path.join(OUT_DIR, "sample.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("wrote %s (%d bytes)" % (pdf_path, len(pdf_bytes)))
    print("wrote %s" % os.path.join(OUT_DIR, "manifest.json"))


if __name__ == "__main__":
    build()
