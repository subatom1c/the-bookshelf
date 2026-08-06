import json
from pathlib import Path
from urllib.parse import quote

from flask import Flask, jsonify, render_template, request, send_from_directory

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
BOOKS_DIR = BASE_DIR / "books"
COVERS_DIR = BASE_DIR / "covers"
CSS_DIR = BASE_DIR / "css"
JS_DIR = BASE_DIR / "js"
LIBRARY_FILE = BASE_DIR / "library.json"


def load_library():
    """Per-book state: {book_id: {"favorite": bool, "notes": str}}."""
    if LIBRARY_FILE.exists():
        try:
            return json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_library(library):
    LIBRARY_FILE.write_text(
        json.dumps(library, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def entry_for(library, book_id):
    return library.setdefault(book_id, {"favorite": False, "notes": ""})


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/books")
def books():
    library = load_library()
    result = []

    for pdf in sorted(BOOKS_DIR.glob("*.pdf")):
        book_id = pdf.stem  # stable id used by favorites/notes
        state = library.get(book_id, {})
        result.append({
            "id": book_id,
            "title": book_id.replace("_", " "),
            # quote() so filenames with spaces/special chars produce valid URLs
            "pdf": f"/books/{quote(pdf.name)}",
            "cover": f"/covers/{quote(book_id)}.png",
            "favorite": bool(state.get("favorite", False)),
            "notes": state.get("notes", ""),
        })

    return jsonify(result)


@app.route("/api/favorite", methods=["POST"])
def set_favorite():
    data = request.get_json(silent=True) or {}
    book_id = data.get("id")
    if not book_id:
        return jsonify({"error": "missing id"}), 400

    library = load_library()
    entry_for(library, book_id)["favorite"] = bool(data.get("favorite", False))
    save_library(library)
    return jsonify({"ok": True, "favorite": library[book_id]["favorite"]})


@app.route("/api/notes", methods=["POST"])
def set_notes():
    data = request.get_json(silent=True) or {}
    book_id = data.get("id")
    if not book_id:
        return jsonify({"error": "missing id"}), 400

    library = load_library()
    entry_for(library, book_id)["notes"] = str(data.get("notes", ""))
    save_library(library)
    return jsonify({"ok": True})


@app.route("/books/<path:filename>")
def serve_book(filename):
    return send_from_directory(BOOKS_DIR, filename)


@app.route("/covers/<path:filename>")
def serve_cover(filename):
    return send_from_directory(COVERS_DIR, filename)


@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(CSS_DIR, filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(JS_DIR, filename)


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(BASE_DIR, "favicon.ico")


if __name__ == "__main__":
    app.run(debug=True)
