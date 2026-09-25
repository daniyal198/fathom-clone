#!/usr/bin/env bash
# Download each source once: 360p video (self-hosted, faststart) + mono audio for transcription.
# Needs yt-dlp (with Node as JS runtime) and ffmpeg. Output: data/media/<id>.mp4, data/media/<id>.mp3, data/seed/<id>.info.json
set -euo pipefail
cd "$(dirname "$0")/../.."
YTDLP="${YTDLP:-yt-dlp}"
mkdir -p data/media data/seed
node -e 'for (const s of require("./scripts/seed/sources.json")) console.log(s.id, s.youtube)' | while read -r id yt; do
  if [ -f "data/media/$id.mp4" ] && [ -f "data/media/$id.mp3" ]; then echo "skip $id"; continue; fi
  echo "== $id ($yt)"
  [ -f "data/media/$id.raw.mp4" ] || "$YTDLP" --js-runtimes node --remote-components ejs:github --extractor-args "youtube:player_client=mweb" \
    -f "bv*[height<=360]+ba/b[height<=360]/b" --merge-output-format mp4 \
    --write-info-json -o "data/media/$id.raw.%(ext)s" "https://www.youtube.com/watch?v=$yt" </dev/null
  if [ -f "data/media/$id.raw.info.json" ]; then mv "data/media/$id.raw.info.json" "data/seed/$id.info.json"; fi
  # YouTube's 360p stream is already ~300 kbps: stream-copy and move the index up front for fast seeking.
  ffmpeg -nostdin -loglevel error -y -i "data/media/$id.raw.mp4" -c copy -movflags +faststart "data/media/$id.mp4"
  ffmpeg -nostdin -loglevel error -y -i "data/media/$id.raw.mp4" -vn -ac 1 -ar 16000 -b:a 48k "data/media/$id.mp3"
  rm -f "data/media/$id.raw.mp4"
done
ls -lh data/media
