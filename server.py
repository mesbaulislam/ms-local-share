#!/usr/bin/env python3
"""
MS Local Transfer - Local HTTP file transfer server.
Android (sender) -> Flask server -> KaiOS (receiver, /receiver)

Run:
    python server.py
    # or:  python server.py --port 8080 --host 0.0.0.0

Optional environment variables:
    MS_TRANSFER_PIN   - if set, uploads / deletes / clear need this PIN
                        (form field "pin" or header "X-Transfer-PIN")
    MS_MAX_UPLOAD_MB  - max upload size in MB (default 500)
    PORT              - port to listen on (default 8080)

No internet, no cloud, no account. LAN only.
"""
import os
import socket
import sys
from datetime import datetime

from flask import (Flask, abort, jsonify, render_template, request,
                   send_from_directory)
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DEFAULT_PORT = int(os.environ.get("PORT", "8080"))
DEFAULT_HOST = "0.0.0.0"
MAX_UPLOAD_MB = int(os.environ.get("MS_MAX_UPLOAD_MB", "500"))
TRANSFER_PIN = os.environ.get("MS_TRANSFER_PIN", "").strip() or None

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
app.config["JSON_SORT_KEYS"] = False


# ---------------------------------------------------------------- helpers
def get_local_ip():
    """Best local LAN IPv4 address (the one other phones must use)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # no packet is actually sent
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    return "127.0.0.1"


def get_all_local_ips():
    ips = []
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    main = get_local_ip()
    if main not in ips:
        ips.insert(0, main)
    return ips


def human_size(num_bytes):
    num_bytes = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024.0 or unit == "GB":
            if unit == "B":
                return "%d B" % int(num_bytes)
            return "%.1f %s" % (num_bytes, unit)
        num_bytes /= 1024.0
    return "%d B" % int(num_bytes)


def safe_name(filename):
    """Return a safe filename, or None if it cannot be used."""
    if not filename:
        return None
    name = secure_filename(filename)
    if not name or name in (".", ".."):
        return None
    return name


def unique_filename(filename):
    """photo.jpg -> photo_1.jpg, photo_2.jpg ... if it already exists."""
    name, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1
    while os.path.exists(os.path.join(UPLOAD_FOLDER, candidate)):
        candidate = "%s_%d%s" % (name, counter, ext)
        counter += 1
    return candidate


def list_files():
    """All uploaded files, newest first. Never exposes server paths."""
    files = []
    try:
        entries = os.listdir(UPLOAD_FOLDER)
    except OSError:
        return files
    for name in entries:
        if name.startswith("."):  # skip .gitkeep and other hidden files
            continue
        path = os.path.join(UPLOAD_FOLDER, name)
        if not os.path.isfile(path):
            continue
        try:
            stat = os.stat(path)
        except OSError:
            continue
        _base, ext = os.path.splitext(name)
        files.append({
            "name": name,
            "extension": ext.lstrip(".").lower() or "file",
            "size": stat.st_size,
            "size_human": human_size(stat.st_size),
            "uploaded_at": datetime.fromtimestamp(stat.st_mtime).strftime(
                "%Y-%m-%d %H:%M"),
            "uploaded_ts": int(stat.st_mtime),
            "download_url": "/download/" + name,
        })
    files.sort(key=lambda f: f["uploaded_ts"], reverse=True)
    return files


def storage_info():
    files = list_files()
    total = sum(f["size"] for f in files)
    return {
        "file_count": len(files),
        "total_size": total,
        "total_size_human": human_size(total),
    }


def pin_ok():
    """True when no PIN is configured, or the supplied PIN matches."""
    if not TRANSFER_PIN:
        return True
    supplied = (request.form.get("pin") or
                request.headers.get("X-Transfer-PIN") or
                (request.get_json(silent=True) or {}).get("pin") or "")
    return supplied == TRANSFER_PIN


def server_info(port):
    ip = get_local_ip()
    return {
        "status": "online",
        "ip": ip,
        "port": port,
        "url": "http://%s:%d" % (ip, port),
        "receiver_url": "http://%s:%d/receiver" % (ip, port),
        "all_ips": get_all_local_ips(),
        "max_upload_mb": MAX_UPLOAD_MB,
        "pin_enabled": bool(TRANSFER_PIN),
        "wifi_ok": not ip.startswith("127."),
    }


# ---------------------------------------------------------------- pages
@app.route("/")
def index():
    info = server_info(app.config.get("PORT", DEFAULT_PORT))
    info.update(storage_info())
    return render_template("index.html", **info)


@app.route("/receiver")
def receiver():
    # Server-rendered list: the page works even with JavaScript off.
    info = server_info(app.config.get("PORT", DEFAULT_PORT))
    info.update(storage_info())
    return render_template("receiver.html", files=list_files(), **info)


# ---------------------------------------------------------------- API
@app.route("/api/status")
def api_status():
    info = server_info(app.config.get("PORT", DEFAULT_PORT))
    info.update(storage_info())
    return jsonify(info)


@app.route("/api/files")
def api_files():
    info = storage_info()
    return jsonify({"files": list_files(), **info})


@app.route("/api/upload", methods=["POST"])
def api_upload():
    if not pin_ok():
        return jsonify({"ok": False, "error": "Wrong PIN."}), 403
    if "files" not in request.files and "file" not in request.files:
        return jsonify({"ok": False,
                        "error": "No file selected. Choose a file first."}), 400

    incoming = request.files.getlist("files") or request.files.getlist("file")
    # Drop empty file fields (browser sends one when nothing is chosen).
    incoming = [f for f in incoming if f and f.filename]
    if not incoming:
        return jsonify({"ok": False,
                        "error": "No file selected. Choose a file first."}), 400

    uploaded, errors = [], []
    for f in incoming:
        clean = safe_name(f.filename)
        if not clean:
            errors.append("Invalid filename: %s" % (f.filename or ""))
            continue
        try:
            final_name = unique_filename(clean)
            dest = os.path.join(UPLOAD_FOLDER, final_name)
            # Werkzeug streams the upload to disk (no whole file in RAM).
            f.save(dest)
            size = os.path.getsize(dest)
            uploaded.append({
                "name": final_name,
                "size": size,
                "size_human": human_size(size),
                "download_url": "/download/" + final_name,
            })
        except Exception as exc:  # disk full, permission, ...
            errors.append("Could not save %s: %s" % (clean, exc))

    if not uploaded:
        return jsonify({"ok": False, "error": "; ".join(errors) or
                        "Upload failed."}), 500
    result = {"ok": True, "uploaded": uploaded, **storage_info()}
    if errors:
        result["errors"] = errors
    return jsonify(result), 200


@app.route("/download/<path:filename>")
def download(filename):
    clean = safe_name(os.path.basename(filename))
    if not clean:
        abort(404)
    path = os.path.join(UPLOAD_FOLDER, clean)
    if not os.path.isfile(path):
        abort(404)
    # as_attachment=True forces a download instead of opening in-browser.
    return send_from_directory(UPLOAD_FOLDER, clean, as_attachment=True)


@app.route("/api/delete/<path:filename>", methods=["POST"])
def api_delete(filename):
    if not pin_ok():
        return jsonify({"ok": False, "error": "Wrong PIN."}), 403
    clean = safe_name(os.path.basename(filename))
    if not clean:
        return jsonify({"ok": False, "error": "File not found."}), 404
    path = os.path.join(UPLOAD_FOLDER, clean)
    if not os.path.isfile(path):
        return jsonify({"ok": False, "error": "File not found."}), 404
    try:
        os.remove(path)
    except OSError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, "deleted": clean, **storage_info()})


@app.route("/api/clear", methods=["POST"])
def api_clear():
    if not pin_ok():
        return jsonify({"ok": False, "error": "Wrong PIN."}), 403
    removed, failed = 0, 0
    for name in os.listdir(UPLOAD_FOLDER):
        if name.startswith("."):  # keep .gitkeep
            continue
        path = os.path.join(UPLOAD_FOLDER, name)
        if not os.path.isfile(path):
            continue
        try:
            os.remove(path)
            removed += 1
        except OSError:
            failed += 1
    return jsonify({"ok": True, "removed": removed, "failed": failed,
                    **storage_info()})


# ---------------------------------------------------------------- errors
@app.errorhandler(413)
def too_large(_exc):
    msg = ("File too large. Maximum upload size is %d MB." % MAX_UPLOAD_MB)
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": msg}), 413
    return msg, 413


@app.errorhandler(404)
def not_found(_exc):
    if request.path.startswith(("/api/", "/download/")):
        return jsonify({"ok": False, "error": "File not found."}), 404
    return "Page not found.", 404


@app.errorhandler(500)
def server_error(_exc):
    if request.path.startswith("/api/"):
        return jsonify({"ok": False,
                        "error": "Server error. Please try again."}), 500
    return "Server error. Please try again.", 500


# ---------------------------------------------------------------- run
def main():
    import argparse
    parser = argparse.ArgumentParser(description="MS Local Transfer server")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    app.config["PORT"] = args.port

    ip = get_local_ip()
    print("=" * 56)
    print("  MS LOCAL TRANSFER - server running")
    print("=" * 56)
    print("  Android / Sender :  http://%s:%d" % (ip, args.port))
    print("  KaiOS  / Receiver:  http://%s:%d/receiver" % (ip, args.port))
    print("  Localhost        :  http://127.0.0.1:%d" % args.port)
    print("  Upload folder    :  %s" % UPLOAD_FOLDER)
    print("  Max upload size  :  %d MB" % MAX_UPLOAD_MB)
    print("  Transfer PIN     :  %s" % ("enabled" if TRANSFER_PIN else "off"))
    if ip.startswith("127."):
        print("  WARNING: no Wi-Fi / LAN address found.")
        print("  Connect this PC/phone to Wi-Fi, then restart the server")
        print("  and use the LAN address shown above - not localhost -")
        print("  on the KaiOS phone.")
    print("  Press Ctrl+C to stop.")
    print("=" * 56)
    sys.stdout.flush()
    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
