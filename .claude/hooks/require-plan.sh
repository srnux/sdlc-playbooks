#!/usr/bin/env bash
# require-plan.sh — BLOCKING gate (exit 2).
#
# No implementation edit lands without work/plans/<STORY-ID>.md.
#
# Why blocking: a plan written after the code is a summary, and a summary never
# catches the thing you'd have noticed before starting. A rule written only as
# prose for an agent to honour will eventually be skipped; this one can't be.
#
# Wired in settings.json under PreToolUse matcher "Edit|Write".
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(pwd)}}"
CONFIG="$PROJECT_DIR/.claude/sdlc.config.json"
[ -f "$CONFIG" ] || exit 0

# gate switched off in config?
if command -v node >/dev/null 2>&1; then
  ENABLED=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$CONFIG','utf8')).artifacts?.gates?.planBeforeCode!==false)}catch(e){console.log('true')}" 2>/dev/null)
  [ "$ENABLED" = "true" ] || exit 0
  PLANS_DIR=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$CONFIG','utf8')).artifacts?.plansDir||'work/plans')}catch(e){console.log('work/plans')}" 2>/dev/null)
else
  PLANS_DIR="work/plans"
fi

INPUT=$(cat)
# Claude sends tool_input.file_path; other harnesses send path. Accept either, so the
# same hook file works from .claude/settings.json and from .codex/hooks.json.
FILE_PATH=$(printf '%s' "$INPUT" \
  | grep -oE '"(file_path|path)"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 \
  | sed -E 's/.*:[[:space:]]*"([^"]+)".*/\1/')
[ -n "$FILE_PATH" ] || exit 0

REL="${FILE_PATH#$PROJECT_DIR/}"

# --- paths this gate does NOT guard -----------------------------------------
# procedure, plans, prototypes, docs, work items, config, tests-only changes
case "$REL" in
  .claude/*|work/*|docs/*|prototype/*|design-system/*|*.md|*.json|*.yaml|*.yml|*.txt) exit 0 ;;
esac

# --- which story are we on? -------------------------------------------------
# First choice: the branch name (sdlc.config.json -> product.branchPattern).
# symbolic-ref works on a branch with no commits yet; rev-parse does not.
BRANCH=$(git -C "$PROJECT_DIR" symbolic-ref --short HEAD 2>/dev/null \
      || git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null \
      || echo "")
STORY_ID=$(printf '%s' "$BRANCH" | grep -oE '(ST|REQ)-[0-9]+' | head -1)

# Fallback: ask the tracker which story is in progress. Without this, working on
# main or on a badly-named branch silently skips the gate — which is exactly the
# case the gate exists for.
if [ -z "$STORY_ID" ] && command -v node >/dev/null 2>&1; then
  STORY_ID=$(cd "$PROJECT_DIR" && node .claude/tools/tracker.mjs list --type story --status in-progress 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const i=JSON.parse(s).items||[];process.stdout.write(i.length===1?i[0].id:'')}catch(e){}})" 2>/dev/null)
fi

if [ -z "$STORY_ID" ]; then
  # Nothing identifies a story: not story work, or more than one in flight.
  # Let it through rather than blocking on an ambiguous guess.
  exit 0
fi

PLAN="$PROJECT_DIR/$PLANS_DIR/$STORY_ID.md"
if [ ! -f "$PLAN" ]; then
  cat >&2 <<EOF
BLOCKED — no plan for $STORY_ID.

  expected: $PLANS_DIR/$STORY_ID.md
  editing:  $REL

Run the plan-story skill first. The plan is a gate, not paperwork: it is where
the five states, the fidelity check against the pinned prototype snapshot, and
the questions get written down — before the code makes them expensive.

  node .claude/tools/tracker.mjs get $STORY_ID
EOF
  exit 2
fi

exit 0
