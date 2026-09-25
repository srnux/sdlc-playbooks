#!/usr/bin/env bash
# check-hardcoded-colors.sh — ADVISORY (exit 0 always, warns on stderr).
#
# Catches a raw colour at the moment it is written, while it's still one line to
# fix. The blocking version of this rule is tools/check-tokens.mjs, run by the
# reviewer; this hook exists so you find out now rather than at review.
#
# Wired in settings.json under PreToolUse matcher "Edit|Write".
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(pwd)}}"
INPUT=$(cat)

# Claude sends tool_input.file_path; other harnesses send path. Accept either, so the
# same hook file works from .claude/settings.json and from .codex/hooks.json.
FILE_PATH=$(printf '%s' "$INPUT" \
  | grep -oE '"(file_path|path)"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 \
  | sed -E 's/.*:[[:space:]]*"([^"]+)".*/\1/')
[ -n "$FILE_PATH" ] || exit 0

REL="${FILE_PATH#$PROJECT_DIR/}"

# the token file is where colours are SUPPOSED to be
case "$REL" in
  design-system/tokens.css) exit 0 ;;
  *.html|*.css|*.scss|*.ts|*.tsx|*.js|*.jsx|*.vue|*.svelte) ;;
  *) exit 0 ;;
esac

# the payload we're about to write
CONTENT=$(printf '%s' "$INPUT" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{const j=JSON.parse(s);const i=j.tool_input||{};
    process.stdout.write([i.content,i.new_string,i.new_str].filter(Boolean).join('\n'));
  }catch(e){}
});" 2>/dev/null)
[ -n "$CONTENT" ] || exit 0

# a line that defines a --ds-* token inside an inlined token block is fine
HITS=$(printf '%s' "$CONTENT" \
  | grep -vE '^\s*--[a-zA-Z0-9_-]+\s*:' \
  | grep -nE '#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(' \
  | head -5)

if [ -n "$HITS" ]; then
  cat >&2 <<EOF
warning — raw colour value in $REL:

$HITS

  Use var(--ds-…) from design-system/tokens.css. If the value you need isn't
  there, that's a design decision — run /design-system rather than inlining it.
  (tools/check-tokens.mjs will fail the review on this.)
EOF
fi

exit 0
