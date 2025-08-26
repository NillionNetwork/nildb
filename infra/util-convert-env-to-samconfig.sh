#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"
SAMCONFIG="samconfig.yaml"

# Convert under_scored_name to PascalCase
to_pascal_case() {
  echo "$1" | awk -F_ '{ for (i=1; i<=NF; ++i) printf toupper(substr($i,1,1)) tolower(substr($i,2)); }'
}

# Build parameter_overrides string
OVERRIDES=""
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  pascal_key=$(to_pascal_case "$key")
  value="${value%\"}"
  value="${value#\"}"
  OVERRIDES+="${pascal_key}=\"${value}\" "
done < "$ENV_FILE"

# Trim trailing space
OVERRIDES=$(echo "$OVERRIDES" | sed 's/ *$//')

# Export for yq
export OVERRIDES

# Write to samconfig.yaml
yq -i '.default.deploy.parameters.parameter_overrides = strenv(OVERRIDES)' "$SAMCONFIG"

# Confirm
echo "✅ Updated $SAMCONFIG with:"
echo "$OVERRIDES"

