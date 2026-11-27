#!/usr/bin/env bash
# Extrai as skills e os evals de um ref git num layout só: <destino>/skills/<skill>/ e <destino>/evals/<skill>/.
# Uso: bash evals/snapshot-baseline.sh <repo> <ref> <destino>   (refazer no mesmo destino troca as duas pastas)
# Acha os três layouts que o histórico tem: skills/<s>/evals, plugins/profills/skills/<s>/evals e evals/<s>.
# Imprime <destino>/skills, que é o campo snapshot do runner.
set -euo pipefail
repo=$1 ref=$2 destino=$3

if git -C "$repo" cat-file -e "$ref:plugins/profills/skills" 2>/dev/null; then
  skills=plugins/profills/skills
else
  skills=skills
fi

rm -rf "$destino/skills" "$destino/evals"
mkdir -p "$destino"
tmp=$(mktemp -d "$destino/.tmp-XXXX")
git -C "$repo" archive "$ref" "$skills" | tar -x -C "$tmp"
mv "$tmp/$skills" "$destino/skills"

mkdir -p "$destino/evals"
if git -C "$repo" cat-file -e "$ref:evals" 2>/dev/null; then
  git -C "$repo" archive "$ref" evals | tar -x -C "$tmp"
  for d in "$tmp"/evals/*/; do
    mv "$d" "$destino/evals/"
  done
else
  for d in "$destino"/skills/*/evals; do
    [ -d "$d" ] || continue
    mv "$d" "$destino/evals/$(basename "$(dirname "$d")")"
  done
fi
rm -rf "$tmp"
echo "$destino/skills"
