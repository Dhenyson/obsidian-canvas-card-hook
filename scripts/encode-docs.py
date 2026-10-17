"""Encode the real-app frames from capture-docs.cjs animation (requires Pillow)."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'manifest.json').read_text())['version']
source = root / 'artifacts/documentation-frames'
timeline = json.loads((source / 'timeline.json').read_text())['frames']
frames = []
for entry in timeline:
    with Image.open(source / entry['file']) as image:
        frames.append(image.convert('RGB').resize((960, 640), Image.Resampling.LANCZOS))

# Share a palette across frames to avoid flicker in the dark Canvas background.
samples = frames[::max(1, len(frames) // 16)]
atlas = Image.new('RGB', (240 * len(samples), 160))
for i, frame in enumerate(samples):
    atlas.paste(frame.resize((240, 160)), (240 * i, 0))
palette = atlas.quantize(colors=256)
indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
destination = root / 'docs/images' / version / 'demo.gif'
indexed[0].save(destination, save_all=True, append_images=indexed[1:],
                duration=[entry['duration'] for entry in timeline], loop=0,
                optimize=True, disposal=1)
print(f'{destination}: {len(frames)} source frames, {sum(e["duration"] for e in timeline) / 1000:.2f}s, {destination.stat().st_size:,} bytes')
