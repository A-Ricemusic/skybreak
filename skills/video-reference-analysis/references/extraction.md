# Segment extraction and evidence

Use these examples when direct segment extraction is appropriate. They are alternatives to an available video-inspection tool, not a requirement to install software or access private accounts. Keep temporary downloads outside the repository unless an evidence-retention task calls for saving them. Do not commit full recordings or signed media URLs by default.

## Retrieve a requested interval

Check for an existing compatible `yt-dlp`, FFmpeg and FFprobe first. Resolve tool/runtime issues explicitly; do not report downloaded content before verifying it. The documented research session used the standalone macOS yt-dlp executable because the system Python was too old for the current Python distribution. Tool availability and website access vary.

Example shell commands (replace the URL, timestamps and paths with the actual request):

```sh
reference_url='https://www.youtube.com/watch?v=VIDEO_ID'
segment_dir="$(mktemp -d /tmp/video-reference.XXXXXX)"

yt-dlp --no-playlist --skip-download --dump-single-json "$reference_url" \
  > "$segment_dir/source-info.json"

yt-dlp --no-playlist --download-sections '*90-205' \
  -f 'bestvideo[height<=1080]+bestaudio/best[height<=1080]' \
  --merge-output-format mp4 -o "$segment_dir/segment.mp4" "$reference_url"

ffprobe -v error -show_entries \
  format=start_time,duration:stream=index,codec_type,width,height,avg_frame_rate,start_time,duration \
  -of json "$segment_dir/segment.mp4"
```

Choose resolution according to the detail required; 1080p is an example, not a mandatory cap. Check returned dimensions and duration. Keep audio only when useful, and do not claim it was inspected simply because it was downloaded.

Stream-copy cuts can include keyframe preroll or non-zero timestamps. Verify the effective start against the original source before attaching precise absolute times to extracted frames. If needed, use a re-encoded exact cut (for example yt-dlp's `--force-keyframes-at-cuts`) and verify it. `ffprobe` alone cannot prove that a clip starts at the intended original event. Record approximate timestamps as approximate.

## Extract an overview and inspect details

```sh
ffmpeg -hide_banner -loglevel error -i "$segment_dir/segment.mp4" \
  -vf 'fps=1/2,scale=480:-1,tile=5x5' \
  "$segment_dir/contact-%03d.png"

ffmpeg -hide_banner -loglevel error -ss 22 \
  -i "$segment_dir/segment.mp4" -frames:v 1 \
  "$segment_dir/detail-at-22s.png"
```

Open every relevant sheet using the available image-viewing tool, then open important frames at full resolution. A default resized preview may hide fine detail. Preserve aspect ratio; enlarging a low-resolution source creates no new information.

At the example two-second sample interval, a 25-tile sheet covers approximately 50 seconds. This is only a navigation aid: sheet padding, timestamps, frame selection and cut offsets must be checked before deriving event times. Use local timestamps in filenames or a frame manifest when precision matters. Do not assume that every black tile is a black frame from the source; final sheets may be padded.

For a short transition, extract a denser bounded interval:

```sh
ffmpeg -hide_banner -loglevel error -ss 28 -i "$segment_dir/segment.mp4" \
  -t 4 -vf 'fps=10,scale=720:-1' \
  "$segment_dir/transition-%03d.png"
```

Inspect the relevant consecutive frames; increase density further if the event requires it. Do not generate thousands of files and then claim coverage without viewing them. Audio analysis requires separate listening-capable tooling or transcription, with its own evidence limits.

## Minimal evidence record

Use a small record per segment; extend it only when needed:

```yaml
source_url: "Original supplied URL"
segment_label: "Mission 1 briefing"
requested_interval: "00:03:25–00:05:10"
retrieved_dimensions: "Verify from the actual stream"
timestamp_mapping: "Verified start offset, or explicitly approximate"
inspection_method: "Contact-sheet interval plus full-size/dense checks"
frames_actually_opened: []
intervals_actually_inspected: []
audio_inspected: false
observations: []
subtitle_or_transcript_context: []
inferences: []
unknowns: []
implementation_comparison: "Not performed unless actually performed"
```

Fill the record from completed inspection. Separate source timestamps from local clip timestamps. An observation should identify its supporting frame/time; an inference should state what evidence is missing. Keep fetched metadata local if it contains expiring download URLs.

The demonstrated AC04 inspection retrieved approximately 01:30–03:25, sampled much of the scene at two-second intervals, and opened selected 1440×1080 frames. That established a visual sequence; it did not establish audio listening or exhaustive frame-by-frame coverage. Do not carry that particular coverage claim into other tasks.

## SKYBREAK campaign research paths and disk budget

Use the committed [reference layout](../../../reference/README.md): all video, frames,
clips, audio, metadata and transcripts stay under gitignored `reference/ac04/`.
Commit only derived text in `reference/ledger.md` and `docs/specs/`; paraphrase
radio/dialogue by function in specs, and never copy transcripts out of the ignored
folder. The human review dashboard is now `docs/human/README.md`, alongside
`shipped.md`, `next.md`, `blockers.md` and `decisions.md` (see AGENTS.md).

With about 14 GB free on the build Mac, download a 480p proxy rather than the full
1080p campaign. These commands run from the repo root with existing yt-dlp and
FFmpeg; they do not install tools. Check tool availability first.

```sh
reference_url='https://youtu.be/lO7bCwQOYUs'
mkdir -p reference/ac04/video reference/ac04/frames/index/scene \
  reference/ac04/frames/index/interval reference/ac04/clips \
  reference/ac04/audio reference/ac04/transcripts

yt-dlp --no-playlist \
  -f 'bestvideo[height<=480]+bestaudio/best[height<=480]' \
  --merge-output-format mp4 \
  -o 'reference/ac04/video/proxy-480p.%(ext)s' "$reference_url"

ffprobe -v error -show_entries \
  format=start_time,duration:stream=codec_type,width,height,avg_frame_rate \
  -of json reference/ac04/video/proxy-480p.mp4 \
  > reference/ac04/video/proxy-info.json
shasum -a 256 reference/ac04/video/proxy-480p.mp4 \
  > reference/ac04/video/proxy-480p.sha256
```

The format selector caps height; record the actual result rather than assuming
480p. Extract scene-change keyframes plus a separate fixed-interval floor of one
frame every 10 seconds. Keep the `showinfo` logs as frame/timestamp manifests;
numbered filenames alone do not encode original source times.

```sh
ffmpeg -hide_banner -i reference/ac04/video/proxy-480p.mp4 \
  -vf "select='gt(scene,0.3)',showinfo" -vsync vfr \
  reference/ac04/frames/index/scene/frame-%06d.png \
  2> reference/ac04/frames/index/scene/timestamps.log

ffmpeg -hide_banner -i reference/ac04/video/proxy-480p.mp4 \
  -vf 'fps=1/10,showinfo' -vsync vfr \
  reference/ac04/frames/index/interval/frame-%06d.png \
  2> reference/ac04/frames/index/interval/timestamps.log
```

Review both sets together; scene detection can miss long static screens, while
the interval floor can miss brief overlays. Retain source-time mapping and inspect
actual images before claiming coverage. Narrower clips or denser sampling are
needed for timing and detail claims. Watch disk usage and remove redundant local
frames/clips once the ledger records their inspection; do not expand storage
without checking available space.

For one bounded 1080p interval, replace `START` and `END` with absolute source
seconds or `HH:MM:SS` timestamps (for example `00:01:30` and `00:03:25`):

```sh
clip_start='START'
clip_end='END'
yt-dlp --no-playlist --download-sections "*${clip_start}-${clip_end}" \
  -f 'bestvideo[height<=1080]+bestaudio/best[height<=1080]' \
  --merge-output-format mp4 --force-keyframes-at-cuts \
  -o 'reference/ac04/clips/mission-detail.%(ext)s' "$reference_url"

ffprobe -v error -show_entries \
  format=start_time,duration:stream=codec_type,width,height,avg_frame_rate \
  -of json reference/ac04/clips/mission-detail.mp4
```

Use a unique output name per range. The selector permits lower resolutions when
1080p is unavailable; verify actual dimensions and effective source start, and
record local-to-source timestamp offsets as described above. Re-encoded cut
boundaries help precision but do not replace inspection. These are recipes, not
a record of an executed download, audio listening or visual analysis.
