#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose --profile tools build
docker compose up -d --wait sql
docker compose --profile tools run --rm schema
docker compose --profile tools run --rm provision
docker compose up -d --wait api frontend proxy
