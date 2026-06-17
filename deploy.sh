#!/usr/bin/env bash
set -Eeuo pipefail

PROGRESS_WIDTH="${PROGRESS_WIDTH:-30}"
DEPLOY_MODE="${DEPLOY_MODE:-pull}"

compose_cmd=()
compose_files=(-f docker-compose.yml)

compose() {
  "${compose_cmd[@]}" "${compose_files[@]}" "$@"
}

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
  echo "  ${compose_cmd[*]} ${compose_files[*]} logs --tail=120"
}

trap fail ERR

cd "$(dirname "$0")"

render_progress 0 "Starting LoveBLog deployment"

if [[ "$DEPLOY_MODE" != "pull" && "$DEPLOY_MODE" != "build" ]]; then
  echo "Unsupported DEPLOY_MODE: $DEPLOY_MODE. Use pull or build."
  exit 1
fi

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

if [[ "$DEPLOY_MODE" == "build" ]]; then
  if [[ ! -f Dockerfile || ! -f package.json || ! -f docker-compose.build.yml ]]; then
    echo "DEPLOY_MODE=build requires the full source repository, including Dockerfile, package.json, and docker-compose.build.yml."
    exit 1
  fi
  compose_files=(-f docker-compose.yml -f docker-compose.build.yml)
fi

render_progress 25 "Validating docker-compose.yml"
compose config >/dev/null

if [[ "$DEPLOY_MODE" == "build" ]]; then
  render_progress 35 "Pulling database image"
  compose pull postgres || true

  render_progress 50 "Building app image locally"
  compose build love-next
else
  render_progress 35 "Pulling images. Large layers may stay here for a while"
  if ! "${compose_cmd[@]}" "${compose_files[@]}" --progress=plain pull; then
    compose pull
  fi
fi

render_progress 75 "Starting containers"
if [[ "$DEPLOY_MODE" == "build" ]]; then
  compose up -d --no-build
elif compose up -d --pull never; then
  :
else
  compose up -d
fi

render_progress 90 "Checking container status"
compose ps

render_progress 100 "Deployment complete"
echo
echo "Open your site at:"
echo "  http://SERVER_IP:3000"
echo
echo "Useful commands:"
echo "  ${compose_cmd[*]} ${compose_files[*]} logs -f love-next"
echo "  ${compose_cmd[*]} ${compose_files[*]} ps"
