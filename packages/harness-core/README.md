# @corbet/harness-core

The reusable proof-of-fix harness: event log, receipts, router, cassettes and budget accounting.

It must stay web-standard: the browser-facing code uses only web APIs, and any Node built-in sits behind a small adapter so the package can later run on Deno.
