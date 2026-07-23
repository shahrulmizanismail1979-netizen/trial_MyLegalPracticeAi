# Synthetic Fixtures

All files in this directory are **synthetic** — invented text created for
testing. They contain no real judgments, no real parties, and no restricted
content. Real restricted case files must never be committed anywhere in this
repository.

The fixtures model the source-container principle (a file is a container, not
automatically a case):

| File | Models |
|------|--------|
| `empty-container.txt` | A file containing no judgment (administrative page only). |
| `single-judgment.txt` | One complete synthetic judgment. |
| `multi-judgment.txt` | Three synthetic judgments plus editorial material in one file. |
| `split-judgment-part1.txt` / `split-judgment-part2.txt` | One synthetic judgment split across two files. |
| `duplicate-of-single.txt` | Byte-identical duplicate of `single-judgment.txt` (checksum dedupe). |
