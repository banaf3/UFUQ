# Agent temporary files

This directory is intentionally tracked so agents can read small, non-sensitive
temporary inputs and handoff files.

Do not place credentials, personal information, restricted reports, generated
dependencies, build output, or private reference material here. Keep temporary
files concise and remove them when they are no longer needed.

The private `local-reference/` directory remains Git-ignored and must not be
copied into this directory.
