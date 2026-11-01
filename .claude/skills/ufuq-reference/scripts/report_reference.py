"""Read-only, local PDF navigation. Does not upload, cache text, or modify files."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[4]
DEFAULT_PDF = ROOT / "local-reference" / "CB23011_FYP_REPORTv2.pdf"
MAX_READ_PAGES = 20


def page_selection(value, total):
    selected = set()
    for part in value.split(","):
        match = re.fullmatch(r"\s*([1-9]\d*)(?:-([1-9]\d*))?\s*", part)
        if not match:
            raise ValueError("Use 1-based pages such as 79-83 or 24,39-40.")
        first = int(match[1])
        last = int(match[2] or match[1])
        if first > last or last > total:
            raise ValueError(f"Page range must be ascending and within 1-{total}.")
        if last - first + 1 > MAX_READ_PAGES:
            raise ValueError(f"Read at most {MAX_READ_PAGES} pages per invocation.")
        selected.update(range(first, last + 1))
        if len(selected) > MAX_READ_PAGES:
            raise ValueError(f"Read at most {MAX_READ_PAGES} pages per invocation.")
    return sorted(selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("inspect", help="Print page count and source SHA-256, not author metadata.")
    search = commands.add_parser("search", help="Find literal text; return page numbers, not excerpts.")
    search.add_argument("--query", required=True)
    search.add_argument("--limit", type=int, default=12)
    read = commands.add_parser("read", help="Print explicitly selected page text to this session.")
    read.add_argument("--pages", required=True)
    args = parser.parse_args()
    source = args.pdf.resolve()
    if not source.is_file() or source.suffix.lower() != ".pdf":
        parser.error("Provide an existing local PDF file.")
    if args.command == "search" and (not args.query.strip() or not 1 <= args.limit <= 98):
        parser.error("Use a non-empty query and a limit between 1 and 98.")
    try:
        from pypdf import PdfReader
    except ImportError:
        parser.error("Install the skill's scripts/requirements.txt in your research Python environment.")
    try:
        reader = PdfReader(source)
        if reader.is_encrypted:
            parser.error("Encrypted PDF: use an authorized readable source; no password guessing.")
        total = len(reader.pages)
        if args.command == "inspect":
            with source.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            print(json.dumps({"file": source.name, "pages": total, "sha256": digest}, indent=2))
        elif args.command == "search":
            query = re.sub(r"\s+", " ", args.query).casefold().strip()
            found = []
            for number, page in enumerate(reader.pages, 1):
                text = re.sub(r"\s+", " ", page.extract_text() or "").casefold()
                hits = text.count(query)
                if hits:
                    found.append({"pdf_page": number, "matches": hits})
            print(json.dumps({"pages_with_matches": len(found), "results": found[:args.limit]}, indent=2))
        else:
            try:
                pages = page_selection(args.pages, total)
            except ValueError as error:
                parser.error(str(error))
            for number in pages:
                print(f"\n--- PDF PAGE {number} ---")
                text = reader.pages[number - 1].extract_text() or ""
                print(text if text.strip() else "[No extractable text: inspect the page image; OCR may be needed.]")
    except (OSError, ValueError) as error:
        parser.error(f"Cannot read PDF: {error}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
