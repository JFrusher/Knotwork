"""Frames (with per-frame durations) to MP4 (social, landing page) and GIF (README)."""
import os, subprocess, sys
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
name, gif_w, mp4_w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
# `seat-to-card-edit` is published as `seat-to-card`, `binder-phone` as `binder`.
src = f"work/frames/{name}/frames.txt"; final = name.removesuffix("-edit").removesuffix("-phone")
os.makedirs("../motion", exist_ok=True)
def run(args): subprocess.run([FF, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], check=True, stdin=subprocess.DEVNULL)
# MP4: 30fps, sharp scaling, yuv420p so every player takes it.
run(["-f", "concat", "-safe", "0", "-i", src, "-vf", f"fps=30,scale={mp4_w}:-2:flags=lanczos",
     "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"../motion/{final}.mp4"])
# GIF: a palette built from the whole clip, and only the part of each frame that changed re-quantised, so still text stays clean.
run(["-f", "concat", "-safe", "0", "-i", src, "-vf",
     f"fps=12,scale={gif_w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
     "-loop", "0", f"../motion/{final}.gif"])
for ext in ("mp4", "gif"):
    print(f"../motion/{final}.{ext}: {os.path.getsize(f'../motion/{final}.{ext}')/1e6:.2f} MB")
