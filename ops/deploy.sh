#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
deploy_root=${DEPLOY_ROOT:-/opt/resume}
service_name=${SERVICE_NAME:-resume}
branch=${DEPLOY_BRANCH:-main}
health_url=${HEALTH_URL:-http://127.0.0.1:3000/health}
keep_releases=${KEEP_RELEASES:-5}

cd "$repo_root"

[[ $(git branch --show-current) == "$branch" ]] || { echo "현재 브랜치가 $branch가 아닙니다." >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "커밋하지 않은 변경사항이 있습니다." >&2; git status --short; exit 1; }

npm run check
git push origin "$branch"

local_sha=$(git rev-parse HEAD)
remote_sha=$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')
[[ $local_sha == "$remote_sha" ]] || { echo "원격 main과 로컬 커밋이 일치하지 않습니다." >&2; exit 1; }

release_id=$(date -u +%Y%m%dT%H%M%SZ)-${local_sha:0:8}
release_dir="$deploy_root/releases/$release_id"
previous_target=''
if [[ -L "$deploy_root/current" ]]; then
  previous_target=$(readlink -f "$deploy_root/current")
fi

mkdir -p "$release_dir" "$deploy_root/shared/study" "$deploy_root/shared/study-files" "$deploy_root/shared/private-files" "$deploy_root/shared/comments" "$deploy_root/shared/chats"
git archive "$local_sha" | tar -x -C "$release_dir"

while IFS= read -r -d '' source_note; do
  target_note="$deploy_root/shared/study/$(basename "$source_note")"
  if [[ ! -e $target_note ]]; then
    cp -a -- "$source_note" "$target_note"
  fi
done < <(find "$release_dir/_study" -maxdepth 1 -type f -name '*.md' -print0)

cd "$release_dir"
npm ci --omit=dev
ln -sfn "$release_dir" "$deploy_root/current.new"
mv -Tf "$deploy_root/current.new" "$deploy_root/current"

rollback() {
  echo "배포 확인에 실패하여 이전 릴리스로 복구합니다." >&2
  if [[ -n $previous_target && -d $previous_target ]]; then
    ln -sfn "$previous_target" "$deploy_root/current.new"
    mv -Tf "$deploy_root/current.new" "$deploy_root/current"
    sudo systemctl restart "$service_name"
  fi
}
trap rollback ERR

sudo systemctl restart "$service_name"
for attempt in {1..15}; do
  if curl --fail --silent --show-error "$health_url" >/dev/null; then
    trap - ERR
    break
  fi
  if [[ $attempt -eq 15 ]]; then
    echo "헬스 체크가 실패했습니다: $health_url" >&2
    false
  fi
  sleep 1
done

mapfile -t old_releases < <(find "$deploy_root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n "+$((keep_releases + 1))" | cut -d' ' -f2-)
for old_release in "${old_releases[@]}"; do
  [[ $old_release == "$previous_target" ]] || rm -rf -- "$old_release"
done

echo "배포 완료: $local_sha"
