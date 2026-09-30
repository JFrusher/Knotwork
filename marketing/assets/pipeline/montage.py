"""Stills to a video: a slow push-in on each, crossfaded. H.264, 30fps."""
import subprocess, sys, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
out, W, H, *names = sys.argv[1:]; W, H = int(W), int(H)
import os; CRF = os.environ.get("CRF", "26")
HOLD, FADE, FPS = 2.8, 0.5, 30
frames = int(HOLD * FPS)
args, chains = [], []
for i, n in enumerate(names):
    args += ["-loop", "1", "-t", str(HOLD), "-i", f"../images/{n}.png"]
    # Upscaled first so zoompan's integer steps are sub-pixel at the output size.
    chains.append(f"[{i}:v]scale={W*3}:{H*3}:flags=lanczos,zoompan=z='1+0.045*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{i}]")
last, t = "v0", HOLD - FADE
for i in range(1, len(names)):
    chains.append(f"[{last}][v{i}]xfade=transition=fade:duration={FADE}:offset={t:.2f}[x{i}]")
    last, t = f"x{i}", t + HOLD - FADE
subprocess.run([FF, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args, "-filter_complex", ";".join(chains), "-map", f"[{last}]",
                "-c:v", "libx264", "-crf", CRF, "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"work/{out}.mp4"],
               check=True, stdin=subprocess.DEVNULL)
print(f"work/{out}.mp4")
