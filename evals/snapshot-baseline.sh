#!/usr/bin/env bash
# Extrai as skills e os evals de um ref git num layout só: <destino>/skills/<skill>/ e <destino>/evals/<skill>/.
# Uso: bash evals/snapshot-baseline.sh <repo> <ref> <destino>   (refazer no mesmo destino troca as pastas)
# Acha os três layouts que o histórico tem: skills/<s>/evals, plugins/profills/skills/<s>/evals e evals/<s>.
# Com plugins/profills/ no ref, o plugin inteiro vai para <destino>/plugin/, para os caminhos que as skills
# fazem a partir da própria pasta (../../scripts/, ../../docs/harness/) acharem os arquivos daquele ref.
# Imprime a pasta das skills, que é o campo snapshot do runner.
set -euo pipefail
repo=$1 ref=$2 destino=$3

rm -rf "$destino/skills" "$destino/plugin" "$destino/evals"
mkdir -p "$destino"
tmp=$(mktemp -d "$destino/.tmp-XXXX")
if git -C "$repo" cat-file -e "$ref:plugins/profills/skills" 2>/dev/null; then
  git -C "$repo" archive "$ref" plugins/profills | tar -x -C "$tmp"
  mv "$tmp/plugins/profills" "$destino/plugin"
  pasta_skills="$destino/plugin/skills"
else
  git -C "$repo" archive "$ref" skills | tar -x -C "$tmp"
  mv "$tmp/skills" "$destino/skills"
  pasta_skills="$destino/skills"
fi

mkdir -p "$destino/evals"
if git -C "$repo" cat-file -e "$ref:evals" 2>/dev/null; then
  git -C "$repo" archive "$ref" evals | tar -x -C "$tmp"
  for d in "$tmp"/evals/*/; do
    mv "$d" "$destino/evals/"
  done
else
  for d in "$pasta_skills"/*/evals; do
    [ -d "$d" ] || continue
    mv "$d" "$destino/evals/$(basename "$(dirname "$d")")"
  done
fi
rm -rf "$tmp"
echo "$pasta_skills"
