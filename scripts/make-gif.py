from pathlib import Path
from PIL import Image


def main() -> None:
    project_root = Path.cwd()
    frames_dir = project_root / "docs" / "frames"
    out_file = project_root / "docs" / "preview.gif"

    frame_paths = sorted(frames_dir.glob("frame-*.png"))
    if not frame_paths:
        raise SystemExit("No frames found in docs/frames")

    frames = [Image.open(p).convert("P", palette=Image.ADAPTIVE) for p in frame_paths]
    first, rest = frames[0], frames[1:]
    first.save(
        out_file,
        save_all=True,
        append_images=rest,
        duration=70,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"GIF created: {out_file}")


if __name__ == "__main__":
    main()
