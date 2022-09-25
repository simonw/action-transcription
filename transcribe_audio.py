import sys
import replicate
import json


def transcribe_audio(filepath):
    model = replicate.models.get("cjwbw/whisper")
    return model.predict(
        audio=open(filepath, "rb"),
        model="large",
        translate=True
    )


if __name__ == "__main__":
    audio_path = sys.argv[-2]
    output_path = sys.argv[-1]
    if not audio_path.endswith(".mp3"):
        print("Please provide an mp3 file")
        sys.exit(1)
    if not output_path.endswith(".json"):
        print("Please provide a .json output file")
        sys.exit(1)
    output = transcribe_audio(audio_path)
    open(output_path, "w").write(json.dumps(output, indent=2) + "\n")
