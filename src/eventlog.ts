// Thin wrapper over @corbet/harness-core: the event log now lives in the core
// so every agent produces receipts the same way. This module keeps its exports
// and signatures; see @corbet/harness-core (in Master07/corbet-agents) for the logic.
export {
  canonicalBytes,
  canonicalJson,
  EventLog,
  GENESIS,
  hashEntry,
  hashEvent,
  verifyChain,
  verifyChainText,
} from "@corbet/harness-core";
export type { ChainCheck, LogEntry } from "@corbet/harness-core";
