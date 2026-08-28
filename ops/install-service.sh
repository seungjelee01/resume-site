#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
deploy_root=${DEPLOY_ROOT:-/opt/resume}
run_user=${RUN_USER:-$(id -un)}
run_group=${RUN_GROUP:-$(id -gn)}
service_name=${SERVICE_NAME:-resume}
unit_target="/etc/systemd/system/${service_name}.service"

if [[ $EUID -eq 0 ]]; then
  echo "RUN_USER를 실제 작업 계정으로 지정해 일반 사용자로 실행하세요." >&2
  echo "예: RUN_USER=jerry RUN_GROUP=jerry bash ops/install-service.sh" >&2
  exit 1
fi

command -v node >/dev/null || { echo "Node.js가 설치되어 있지 않습니다." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm이 설치되어 있지 않습니다." >&2; exit 1; }

sudo install -d -o "$run_user" -g "$run_group" -m 0755 \
  "$deploy_root" \
  "$deploy_root/releases" \
  "$deploy_root/shared" \
  "$deploy_root/shared/study" \
  "$deploy_root/shared/study-files" \
  "$deploy_root/shared/private-files" \
  "$deploy_root/shared/comments"
sudo install -d -o "$run_user" -g "$run_group" -m 0700 "$deploy_root/shared/chats"
sudo install -d -o "$run_user" -g "$run_group" -m 0700 "$deploy_root/shared/analytics"

if [[ ! -e "$deploy_root/shared/resume.env" ]]; then
  env_tmp=$(mktemp)
  trap 'rm -f "$env_tmp" "${unit_tmp:-}"' EXIT
  printf 'NODE_ENV=production\nHOST=127.0.0.1\nPORT=3000\nSTUDY_DIR=%s/shared/study\nSTUDY_FILES_DIR=%s/shared/study-files\nPRIVATE_FILES_DIR=%s/shared/private-files\nCOMMENTS_DIR=%s/shared/comments\nCHATS_DIR=%s/shared/chats\nANALYTICS_DIR=%s/shared/analytics\n' "$deploy_root" "$deploy_root" "$deploy_root" "$deploy_root" "$deploy_root" "$deploy_root" > "$env_tmp"
  sudo install -o "$run_user" -g "$run_group" -m 0640 "$env_tmp" "$deploy_root/shared/resume.env"
fi

unit_tmp=$(mktemp)
sed \
  -e "s|@@RUN_USER@@|$run_user|g" \
  -e "s|@@RUN_GROUP@@|$run_group|g" \
  -e "s|@@DEPLOY_ROOT@@|$deploy_root|g" \
  "$repo_root/ops/resume.service.template" > "$unit_tmp"
sudo install -m 0644 "$unit_tmp" "$unit_target"
sudo systemctl daemon-reload

echo "서비스 기반 설정이 완료되었습니다."
echo "환경 설정: $deploy_root/shared/resume.env"
echo "첫 배포: npm run deploy"
