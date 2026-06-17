#!/usr/bin/env bash
set -Eeuo pipefail

PROGRESS_WIDTH="${PROGRESS_WIDTH:-30}"

compose_cmd=()

render_progress() {
  local percent="$1"
  local label="$2"
  local filled=$((percent * PROGRESS_WIDTH / 100))
  local empty=$((PROGRESS_WIDTH - filled))
  local left=""
  local right=""

  printf -v left "%*s" "$filled" ""
  printf -v right "%*s" "$empty" ""
  left="${left// /#}"
  right="${right// /-}"

  printf "\n[%s%s] %3d%% %s\n" "$left" "$right" "$percent" "$label"
}

fail() {
  echo
  echo "Deploy failed. Show recent logs with:"
  echo "  ${compose_cmd[*]} logs --tail=120"
}

trap fail ERR

cd "$(dirname "$0")"

render_progress 0 "Starting LoveBLog deployment"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose)
else
  echo "Docker Compose is not installed."
  exit 1
fi

render_progress 8 "Docker is ready"
docker version >/dev/null

render_progress 15 "Docker Compose is ready"
"${compose_cmd[@]}" version

render_progress 25 "Validating docker-compose.yml"
"${compose_cmd[@]}" config >/dev/null

render_progress 35 "Pulling images. Large layers may stay here for a while"
if ! "${compose_cmd[@]}" --progress=plain pull; then
  "${compose_cmd[@]}" pull
fi

render_progress 75 "Starting containers"
"${compose_cmd[@]}" up -d

render_progress 90 "Checking container status"
"${compose_cmd[@]}" ps

render_progress 100 "Deployment complete"
echo
echo "Open your site at:"
echo "  http://SERVER_IP:3000"
echo
echo "Useful commands:"
echo "  ${compose_cmd[*]} logs -f love-next"
echo "  ${compose_cmd[*]} ps"
