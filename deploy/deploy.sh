#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose -f compose.production.yaml --profile tools build
docker compose -f compose.production.yaml up -d --wait sql
docker compose -f compose.production.yaml --profile tools run --rm schema
docker compose -f compose.production.yaml --profile tools run --rm provision
docker compose -f compose.production.yaml up -d --wait api frontend proxy
