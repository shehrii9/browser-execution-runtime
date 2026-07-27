#!/usr/bin/env bash
# Start daemon with a local Ollama (or other OpenAI-compatible) planner.
# Prerequisites: Ollama running with a pulled model, e.g. `ollama pull llama3.2`
set -euo pipefail

export BER_LLM_API_BASE="${BER_LLM_API_BASE:-http://127.0.0.1:11434/v1}"
export BER_LLM_MODEL="${BER_LLM_MODEL:-llama3.2}"
# Local Ollama does not need a key; leave BER_LLM_API_KEY unset.

echo "Planner: $BER_LLM_API_BASE model=$BER_LLM_MODEL"
echo "Starting daemon (Ctrl+C to stop)..."
exec npm run daemon
