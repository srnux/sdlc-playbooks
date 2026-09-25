# Tracker — one adapter, swappable backend

**No playbook or command ever talks to a tracker directly.** They shell out to
`node .claude/tools/tracker.mjs <verb>`, which reads `sdlc.config.json → tracker.provider`
and dispatches to a provider module. Today that is `files` (markdown in `work/items/`).
Tomorrow it can be `jira` without a single edit above this line.

This is the whole point of the indirection: the flow's logic is about *requirements,
prototypes and stories*, not about issue keys and transition ids.

## The verbs

Every verb prints JSON to stdout and exits non-zero on failure.

| Verb | Use |
|------|-----|
| `list [--type requirement\|story] [--status S] [--parent ID]` | items, newest id last |
| `get <ID>` | one item: frontmatter fields + `body` |
| `create --type T --title "…" [--parent ID] [--body-file F] [--set k=v …]` | allocates the next id, returns it |
| `set <ID> [--status S] [--set k=v …]` | change fields; refuses an unknown status |
| `body <ID> --file F` | replace the body (AC, context) wholesale |
| `comment <ID> "text"` | append a dated note to the item |
| `next [--type story]` | the next actionable item, or `null` |

Statuses come from `sdlc.config.json → statuses`, per type. `set` validates against that
list, so a typo fails loudly instead of creating a ghost state.

## Adding a provider (e.g. Jira)

1. Copy `tools/tracker/files.mjs` to `tools/tracker/<name>.mjs`.
2. Export the same seven functions — `list, get, create, set, setBody, comment, next` —
   taking `(cfg, args)` and returning plain objects with **the generic field names**
   (`id, type, title, status, parent, screens, prototype, approvedVersion, body`).
   Translating those to the backend's vocabulary is the provider's job, not the caller's.
3. Map statuses through `cfg.tracker.<name>.statusMap` and custom fields through
   `fieldMap`, so the generic vocabulary survives.
4. Register it in the `PROVIDERS` map in `tools/tracker.mjs`.
5. Flip `tracker.provider` in `sdlc.config.json`.

`tools/tracker/jira.mjs` ships as a working skeleton with every call site marked `TODO`
and the field translation already written — fill in the transport (MCP tool call or REST)
and it runs.

## Why ids still live in files

Even with Jira as the tracker, the *artifacts* — prototype snapshots, plans, docs — stay
in the repo and reference items by id. The tracker holds status and conversation; the repo
holds the work. That split is what lets the flow survive a tracker migration, and what
lets a human finish a story with the tracker offline.
