# Athena ↔ OpenClaw Folder Mapping

This document maps the folder structures between **Athena** (memory system for AI agents) and **OpenClaw** (personal AI assistant).

---

## Overview

| Aspect | Athena | OpenClaw |
|:-------|:-------|:---------|
| **Purpose** | Memory/Persistence layer for AI agents | Full AI Assistant with multi-channel support |
| **Language** | Python | TypeScript/Node.js |
| **Architecture** | Local-first, Markdown-based | Gateway + Channels + Extensions |
| **Data Storage** | Markdown files + Supabase (vector) | SQLite + LanceDB (vector) |

---

## Core Component Mapping

### 1. Memory & Persistence

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/src/athena/memory/` | `openclaw/src/memory/` | Core memory/vector storage |
| `Athena-Public/docs/MEMORY_BANK.md` | `openclaw/extensions/memory-core/` | Memory core extension |
| `Athena-Public/docs/VECTORRAG.md` | `openclaw/extensions/memory-lancedb/` | LanceDB vector backend |
| `Athena-Public/supabase/` | `openclaw/extensions/` | Database/Storage backends |
| `Athena-Public/docs/GRAPHRAG.md` | `openclaw/src/agents/memory-search.ts` | Knowledge graph + search |
| `Athena-Public/docs/KNOWLEDGE_GRAPH.md` | `openclaw/src/agents/` | Graph-based memory |

### 2. Protocols & Skills

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/examples/protocols/` | `openclaw/skills/` | Reusable agent behaviors |
| `Athena-Public/docs/WORKFLOWS.md` | `openclaw/src/agents/` | Workflow automation |
| `Athena-Public/docs/TOP_10_PROTOCOLS.md` | `openclaw/docs/reference/` | Core protocols reference |
| `Athena-Public/examples/templates/` | `openclaw/docs/reference/templates/` | Agent templates (AGENTS.md, SOUL.md, TOOLS.md) |

### 3. Scripts & Tools

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/scripts/` | `openclaw/scripts/` | Operational scripts |
| `Athena-Public/examples/scripts/` | `openclaw/src/agents/` | Agent tools & utilities |
| `Athena-Public/scripts/boot.py` | `openclaw/src/runtime.ts` | Runtime initialization |
| `Athena-Public/scripts/shutdown.py` | `openclaw/src/runtime.ts` | Graceful shutdown |
| `Athena-Public/scripts/athena_status.py` | `openclaw/src/agents/identity.ts` | Status/health checks |

### 4. Agent Runtime

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/src/athena/` | `openclaw/src/agents/` | Core agent logic |
| `Athena-Public/AGENTS.md` | `openclaw/AGENTS.md` | Agent definitions |
| `Athena-Public/docs/CAPABILITIES.md` | `openclaw/src/agents/defaults.ts` | Agent capabilities |
| `Athena-Public/docs/MCP_SERVER.md` | `openclaw/src/plugins/` | MCP/Plugin server |

### 5. Configuration & Governance

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/.env.example` | `openclaw/.env.example` | Environment template |
| `Athena-Public/pyproject.toml` | `openclaw/package.json` | Project dependencies |
| `Athena-Public/docs/SECURITY.md` | `openclaw/docs/security/` | Security configuration |
| `Athena-Public/docs/LOCAL_MODE.md` | `openclaw/Dockerfile*` | Local/Docker deployment |

### 6. Documentation

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/docs/` | `openclaw/docs/` | Documentation |
| `Athena-Public/README.md` | `openclaw/README.md` | Project overview |
| `Athena-Public/docs/ARCHITECTURE.md` | `openclaw/docs/concepts/architecture.md` | System design |
| `Athena-Public/docs/GETTING_STARTED.md` | `openclaw/docs/start/getting-started.md` | Setup guide |
| `Athena-Public/docs/FAQ.md` | `openclaw/docs/start/faq.md` | Common questions |

### 7. Session & Context Management

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/docs/YOUR_FIRST_SESSION.md` | `openclaw/docs/start/onboarding.md` | First-time setup |
| `Athena-Public/examples/session_logs/` | `openclaw/src/sessions/` | Session management |
| `Athena-Public/scripts/context_monitor.py` | `openclaw/src/agents/context.ts` | Context monitoring |

### 8. Search & Retrieval

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/docs/SEMANTIC_SEARCH.md` | `openclaw/src/memory/manager-search.ts` | Semantic search |
| `Athena-Public/docs/MCP_SERVER.md` | `openclaw/src/agents/memory-search.ts` | Memory search tools |
| `Athena-Public/examples/scripts/fast_search.py` | `openclaw/src/memory/search-manager.ts` | Fast search implementation |

### 9. Multi-Agent & Coordination

| Athena | OpenClaw | Description |
|:-------|:---------|:------------|
| `Athena-Public/docs/protocols/413-multi-agent-coordination.md` | `openclaw/src/agents/sessions.ts` | Multi-agent sessions |
| `Athena-Public/scripts/parallel_orchestrator.py` | `openclaw/src/agents/cli-runner.ts` | Parallel execution |

---

## Conceptual Equivalents

### Athena Concepts → OpenClaw Implementation

| Athena Concept | OpenClaw Equivalent |
|:---------------|:-------------------|
| **Memory Bank** | `src/memory/index.ts` + `extensions/memory-core` |
| **Protocols** | `skills/` directory + `AGENTS.md` |
| **Cold Storage** | `src/memory/sqlite.ts` (local files) |
| **Hot Storage** | `extensions/memory-lancedb/` (vector DB) |
| **Heartbeat** | `src/daemon/` + cron jobs |
| **Adaptive Latency** | Model fallback + routing in `src/agents/` |
| **Capabilities** | Tool definitions in `src/tools/` |
| **Boot (/start)** | Gateway startup + session init |
| **Shutdown (/end)** | Session save + context compaction |

### Data Flow Comparison

```
Athena: /start → Load Identity → Memory Recall → Work → /end → Save to Memory
OpenClaw: Gateway Start → Session Init → Agent Loop → Session End → Context Compaction
```

---

## Files That Could Be Shared/Copied

1. **Documentation Structure**: Many Athena docs could enhance OpenClaw's docs
   - `docs/GLOSSARY.md` → `docs/concepts/`
   - `docs/TECH_DEBT.md` → OpenClaw equivalents

2. **Protocol Templates**: Athena's protocol structure could inspire OpenClaw skills
   - `examples/protocols/decision/` → `skills/`

3. **Memory Architecture**: Athena's hybrid RAG could enhance OpenClaw's memory
   - Vector search + GraphRAG integration

4. **Operational Scripts**: Some Athena scripts have OpenClaw equivalents
   - Status checks, boot/shutdown, context monitoring

---

## Gap Analysis

### Athena Has, OpenClaw Needs

| Feature | Athena Location | OpenClaw Status |
|:--------|:----------------|:----------------|
| Knowledge Graph | `docs/KNOWLEDGE_GRAPH.md` | Basic (needs enhancement) |
| Hybrid RAG (5 sources) | `docs/SEMANTIC_SEARCH.md` | Partial |
| MCP Server | `docs/MCP_SERVER.md` | Via plugin-sdk |
| Protocol Templates | `examples/protocols/` | Skills system exists |
| Context Compression | `scripts/compress_context.py` | Partial in `src/agents/compaction.ts` |

### OpenClaw Has, Athena Needs

| Feature | OpenClaw Location | Athena Status |
|:--------|:------------------|:--------------|
| Multi-channel (WhatsApp, etc.) | `src/channels/` | N/A |
| Gateway Architecture | `src/gateway/` | N/A |
| Docker/Sandboxing | `Dockerfile*`, `src/security/` | N/A |
| Browser Control | `src/browser/` | N/A |
| Voice/Talk Mode | `src/tts/`, `src/nodes/` | N/A |

---

## Integration Opportunities

1. **Athena Memory in OpenClaw**: Port Athena's memory layer to OpenClaw as an alternative backend
2. **Athena Protocols as Skills**: Convert Athena protocols to OpenClaw skills
3. **Unified Context Management**: Combine Athena's boot context with OpenClaw's session model
4. **Shared Documentation**: Cross-reference both projects' docs

---

## Precise file-to-file mappings (new / clarifications) 🔧
These are concrete Athena → OpenClaw file equivalences I added to close gaps in the original mapping.

- `Athena-Public/src/athena/memory/vectors.py` → `openclaw/src/memory/embeddings.ts` — embedding creation & provider selection
- `Athena-Public/src/athena/memory/sync.py` → `openclaw/src/memory/sync-index.ts` + `openclaw/src/memory/sync-session-files.ts` — memory sync/reindex
- `Athena-Public/src/athena/memory/schema.sql` → `openclaw/src/memory/memory-schema.ts` + `openclaw/src/memory/sqlite.ts` (schema equivalents)
- `Athena-Public/src/athena/memory/delta_manifest.py` → `openclaw/src/memory/qmd-manager.ts` / `sync-stale.ts` — delta / qmd handling
- `Athena-Public/src/athena/sessions.py` → `openclaw/src/agents/workspace.ts` + `openclaw/src/memory/session-files.ts` — session read/write
- `Athena-Public/src/athena/mcp_server.py` → `openclaw/skills/mcporter/` + `openclaw/src/gateway/*` — MCP server/clients
- `Athena-Public/scripts/boot.py` → `openclaw/src/wizard/onboarding.ts` + `openclaw/src/infra/heartbeat-runner.ts` — boot / startup orchestration
- `Athena-Public/scripts/shutdown.py` → `openclaw/src/agents/compaction.ts` + `openclaw/src/agents/pi-extensions/compaction-safeguard.ts` — session finalization / compaction
- `Athena-Public/docs/GRAPHRAG.md` → `openclaw/src/agents/memory-search.ts` + `openclaw/src/memory/manager-search.ts` — GraphRAG concepts
- `Athena-Public/examples/protocols/` → `openclaw/skills/` — convert protocol templates → skills
- `Athena-Public/supabase/MASTER_SCHEMA.sql` & `supabase/migrations/` → suggested new `openclaw/extensions/memory-supabase/` (schema + migration scripts)
- `Athena-Public/examples/templates/` → `openclaw/docs/reference/templates/` — template docs & `AGENTS.md`

---

## Environment / config mapping 🔁
Quick env-equivalents and recommendations.

- `GOOGLE_API_KEY` (Athena) → `GEMINI_API_KEY` or `GEMINI`-compatible envs in `openclaw/.env`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` (Athena) → no direct OpenClaw equivalent; recommend adding `OPENCLAW_SUPABASE_URL` + `OPENCLAW_SUPABASE_KEY` and an `extensions/memory-supabase` plugin
- Athena embedding model (3072d) → verify `openclaw` embedding-provider config (OpenClaw supports Gemini/OpenAI). Add normalization step when porting vectors (dimensionality check + fallback)
- CLI/runtime flags in `Athena/scripts/*` → map to `openclaw` CLI (`src/cli/`) or `openclaw/scripts/`

---

## Gap / porting checklist (practical) ✅
Short prioritized tasks to make Athena features work inside OpenClaw.

1. POC: import Athena markdown memory into OpenClaw SQLite index (small, 1–2 days)
   - script: `tools/migrate-athena-memory.ts` that validates embedding dims and inserts into `embedding_cache`
2. Implement `extensions/memory-supabase/` (medium, 3–5 days)
   - include: schema importer from `supabase/MASTER_SCHEMA.sql`, connector, config + tests
3. Protocol → Skill conversion (small → medium)
   - convert top `examples/protocols/*` → `skills/` and add `SKILL.md` + unit tests
4. Knowledge-graph / GraphRAG integration (medium)
   - map `GRAPHRAG.md` flows to `src/memory/manager-search.ts` + example skill
5. Embedding compatibility check (urgent)
   - ensure OpenClaw reindexes / truncates or projects Athena 3072-d vectors to supported models
6. Docs + examples (small)
   - add cross-references in `openclaw/docs/` and `AGENTS.md`

---

## Missing mappings I added here (quick summary)
- Precise file-to-file lines for memory, sync, sessions, MCP, boot/shutdown, supabase → proposed extension
- Env-variable equivalences and recommended new env names
- Actionable porting checklist and priorities

---

## Quick integration plan (3 steps) 🚀
1. Create importer that converts Athena Supabase/markdown memory into OpenClaw `embedding_cache` (POC).  
2. Add `extensions/memory-supabase` (optional full feature).  
3. Port 3 high-value Athena protocols → OpenClaw `skills/` and add end-to-end tests.

---

## Next steps — pick one
1. I can scaffold `extensions/memory-supabase/` in this workspace (I will create files). 🧩
2. I can add a POC migration script to import Athena memory into OpenClaw (I will implement it). ⚙️
3. I can port specified Athena `examples/protocols/*` → `openclaw/skills/` and add tests (you pick which protocols). 🔁

Tell me which step to do next and I will start it.

---

*Last updated: 17 Feb 2026*
