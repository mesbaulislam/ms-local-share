# MS Local Share

Transfer files from an **Android phone to a KaiOS feature phone** over the
same Wi-Fi network. No internet, no cloud, no account, no registration.

> Built as **MS Local Transfer** — the code, file names and on-screen text
> still use that name in places (`server.py`, the page titles). This
> repository is published under the name **MS Local Share**.

- **Android = Sender** — modern dashboard at `/`
- **KaiOS = Receiver** — lightweight page at `/receiver`
  (KaiOS 2.5.3.2, 240×320, tested target: Energizer E241S)
- **PC = Optional server host** — or run the server on the Android phone
  itself with Termux / Pydroid 3

Stack: Python 3 + Flask + plain HTML/CSS/vanilla JavaScript. No CDN, no
external fonts, no frameworks, no database.

## What this does — and what it does not do

There is **one** transfer flow in this project:

```
Android browser  -- upload -->  Flask server (uploads/ folder)
                                        |
KaiOS browser    -- download <-  /receiver  (server-rendered list)
```

| Direction | Implemented? | How |
|---|---|---|
| Android → server (upload) | Yes | Sender dashboard at `/`, `POST /api/upload` |
| Server → KaiOS (download) | Yes | Receiver page at `/receiver`, `GET /download/<filename>` |
| KaiOS → server / PC (upload) | **No** | The receiver page has no upload form — it only lists files and links to download them |
| PC → KaiOS (direct push) | **No separate feature** | There is no PC app and no push. If the server runs on a PC, opening the sender page in the PC browser uploads a file from that PC through the same `/api/upload` endpoint — that is the same upload endpoint, not a separate PC-to-phone feature |
| PC → PC / Android → Android | Not the purpose | Any modern browser can open `/` and upload, and any browser can open `/receiver` and download, but the project is designed for Android → KaiOS |

In short: files only ever flow **into** the server by upload, and **out of**
the server by download. Nothing is sent directly from one phone to the other.

## Project structure

```
ms-local-share/
  server.py            # Flask backend + all API endpoints (unchanged)
  requirements.txt     # Flask, Werkzeug
  start_server.bat     # Windows double-click starter
  start_termux.sh      # Android (Termux) starter
  README.md
  .gitignore
  uploads/             # uploaded files are stored here (.gitkeep only in git)
  templates/
    index.html         # Android sender dashboard
    receiver.html      # KaiOS receiver page (server-rendered)
  static/
    css/
      style.css        # Android dashboard styles
      receiver.css     # KaiOS styles (no CSS variables, no grid)
    js/
      app.js           # Sender logic (ES5, XMLHttpRequest progress)
      receiver.js      # Receiver auto-refresh, optional, ES5
    icons/
      icon.svg         # MS logo
```

## How it works

1. `server.py` starts a Flask server on `0.0.0.0:8080` (LAN only).
2. The sender opens `http://<server-IP>:8080/` in a browser, selects one or
   more files, and uploads them. Files are saved to `uploads/` on the machine
   running the server. Duplicate names are renamed automatically:
   `photo.jpg` → `photo_1.jpg` → `photo_2.jpg`.
3. The receiver opens `http://<server-IP>:8080/receiver` in the KaiOS
   browser. The server renders the file list as plain HTML, so the list and
   the download links work even with JavaScript switched off.
4. Tapping **Download** sends the file with
   `Content-Disposition: attachment`, so the KaiOS browser offers to save it.
5. The sender dashboard can also delete one file (`POST /api/delete/...`)
   or clear all uploaded files (`POST /api/clear`).

The server never executes uploaded files and never exposes server paths —
the file list only returns names, sizes and download URLs.

## Server requirements

- **Python 3.8+** (Flask 3 requires Python 3.8 or newer)
- **pip** — to install the dependencies in `requirements.txt`
- **Flask >= 3.0, < 4.0** and **Werkzeug >= 3.0, < 4.0**
- A free TCP port — default **8080**
- Disk space in the `uploads/` folder for the files being transferred
- No internet connection is needed at run time — only a local network

## Supported platforms

| Role | Platform | Notes |
|---|---|---|
| Server host | Windows 10 / 11 | Double-click `start_server.bat`, or `python server.py` |
| Server host | Linux / macOS | `python3 server.py` |
| Server host + sender | Android, via Termux | See "Run the server on Android" below; recommended |
| Server host + sender | Android, via Pydroid 3 | Open `server.py` and press Run; Termux is more reliable for keeping the server running |
| Sender | Any modern browser | Chrome on Android is the documented sender; the dashboard uses plain HTML/CSS/ES5 JavaScript |
| Receiver | KaiOS 2.5.3.2, 240×320 | Target device: Energizer E241S. Built-in KaiOS browser |

## Network requirements

- The server machine/phone and the KaiOS phone **must be on the same
  Wi-Fi network** (or the same hotspot — see below).
- Use the **LAN address** printed when the server starts, for example
  `http://192.168.1.100:8080/receiver`. Do **not** use `localhost` /
  `127.0.0.1` on the KaiOS phone — that address means the KaiOS phone
  itself, not the server.
- The server binds to `0.0.0.0`, which means "this machine's LAN address".
  It is **not** exposed to the internet.
- If the KaiOS phone shows "Connection refused", check that both devices
  are on the same Wi-Fi and that the PC/phone firewall allows port 8080.
- If the server prints only `127.0.0.1`, no Wi-Fi/LAN address was found —
  connect to Wi-Fi, then restart the server.
- **No Wi-Fi router?** Turn on the **hotspot** on the Android phone and
  connect the KaiOS phone to that hotspot. The server address is then
  usually `http://192.168.43.1:8080` (check the address the server prints).

## Installation

### 1. Install Python 3

- Windows: https://www.python.org/downloads/ — tick
  **"Add Python to PATH"** during installation.
- Linux / macOS: Python 3 is usually pre-installed
  (`python3 --version`).

### 2. Install dependencies

```bash
cd ms-local-share
pip install -r requirements.txt
```

## Running the server

### On Windows (PC as server host)

Double-click **`start_server.bat`**, or from a terminal:

```bash
python server.py
```

### On Linux / macOS (PC as server host)

```bash
python3 server.py
```

### Run the server on Android itself (no PC needed)

Your Android phone can be the server **and** the sender at the same time.

**Termux method (recommended):**

1. Install **Termux** from **F-Droid** (do NOT use the Play Store version —
   it is outdated and no longer updated).
2. Download this project as a ZIP on your phone and extract it
   (for example with ZArchiver) into the `Download` folder.
3. Open Termux and run, one by one:
   ```bash
   pkg update && pkg install python -y
   termux-setup-storage
   cd ~/storage/downloads/ms-local-share
   bash start_termux.sh
   ```
   The first run installs Flask automatically; next time just run the
   last two lines.
4. Termux will print the addresses, for example
   `http://192.168.1.100:8080` and `http://192.168.1.100:8080/receiver`.
5. Keep Termux open in the foreground while transferring. On the same
   phone, open `http://127.0.0.1:8080` in Chrome to upload; on the
   KaiOS phone, open the LAN address (`/receiver`) to download.

**Pydroid 3 method (easier, no commands):** install **Pydroid 3** from
the Play Store, open it, install Flask from its Pip menu, open
`server.py` from the extracted folder and press Run. Termux is more
reliable for keeping the server running, so prefer it if Pydroid
stops or struggles.

The server prints its addresses, for example:

```
Android / Sender :  http://192.168.1.100:8080
KaiOS  / Receiver:  http://192.168.1.100:8080/receiver
```

## Usage

1. Connect both phones to the same Wi-Fi (or the Android hotspot).
2. Start the server (PC, or Termux on Android) and note the LAN address.
3. On Android, open the sender URL in Chrome, for example
   `http://192.168.1.100:8080/`.
4. Tap **Select Files**, choose one or more files, tap **Upload**.
   Any file type works — images, videos, audio, documents, ZIP.
5. On KaiOS, open the receiver URL in the built-in browser, for example
   `http://192.168.1.100:8080/receiver`.
6. Tap **Download** next to the file. The KaiOS browser saves it.
7. To remove files, use **Delete** next to a file or **Clear History**
   on the sender dashboard.

## Configuration

| Setting | How | Default |
|---|---|---|
| Port | `python server.py --port 8080` or `PORT=8080` | `8080` |
| Host | `python server.py --host 0.0.0.0` | `0.0.0.0` |
| Max upload size | `MS_MAX_UPLOAD_MB=500 python server.py` | `500 MB` |
| Transfer PIN | `MS_TRANSFER_PIN=1234 python server.py` | off (no PIN) |

Windows (PowerShell):

```powershell
$env:MS_TRANSFER_PIN="1234"; $env:MS_MAX_UPLOAD_MB="1000"; python server.py
```

When a PIN is set, uploads, deletes and clearing require it (enter it in
the dashboard). Downloads on the LAN stay open — see Security below.
`1234` above is only an example — choose your own PIN and never commit a
real PIN to the repository.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Android sender dashboard |
| GET | `/receiver` | KaiOS receiver page |
| POST | `/api/upload` | Upload one or more files (`files` form field, multipart) |
| GET | `/api/files` | JSON list of uploaded files |
| GET | `/download/<filename>` | Download a file (attachment) |
| GET | `/api/status` | Server status, IP, URLs, storage info |
| POST | `/api/delete/<filename>` | Delete one file |
| POST | `/api/clear` | Delete all uploaded files |

Example:

```bash
curl http://192.168.1.100:8080/api/status
curl -F "files=@photo.jpg" -F "files=@song.mp3" http://192.168.1.100:8080/api/upload
curl -O http://192.168.1.100:8080/download/photo.jpg
```

## KaiOS compatibility

Target: **KaiOS 2.5.3.2**, 240×320 screen, keypad navigation
(Energizer E241S).

- Receiver page is **server-rendered HTML** — the file list and download
  links work even with JavaScript switched off.
- ES5 JavaScript only: no arrow functions, no `async`/`await`, no `fetch()`
  (XMLHttpRequest only), no modern browser APIs.
- No CSS variables, no CSS Grid, no animations, small CSS footprint.
- Standard `<a>` download links with `Content-Disposition: attachment`.
- Large readable text, high contrast, no hover-dependent interactions.
- The receiver page auto-refreshes the file list every 30 seconds when
  JavaScript is on (`static/js/receiver.js`); otherwise use the
  **Refresh Files** link.

## Security

- The server binds to the local network only (`0.0.0.0` = your LAN).
  It is **not** exposed to the internet.
- Filenames are sanitised with `secure_filename()` and path traversal
  is blocked — downloads can only come from the `uploads/` folder.
- Uploaded files are never executed.
- No passwords, tokens, API keys or private network credentials are
  stored in this repository. The PIN is set only through the
  `MS_TRANSFER_PIN` environment variable at run time.
- **Warning:** with no PIN set, anyone connected to the same Wi-Fi
  network can open the server and download files. Set
  `MS_TRANSFER_PIN` if other people share your Wi-Fi. Downloads
  themselves are not PIN-protected; the PIN protects uploads, deletes
  and clearing.

## Screenshots

No screenshots are included — none were available in the project when
this repository was published.

## Troubleshooting

| Problem | Fix |
|---|---|
| KaiOS shows "Connection refused" | Both phones must be on the **same** Wi-Fi. Use the LAN IP from the server banner, not `localhost`. Check the PC/phone firewall allows port 8080. |
| Server shows `127.0.0.1` only | No Wi-Fi/LAN address found. Connect to Wi-Fi, then restart the server. |
| Upload fails / file too large | Default limit is 500 MB. Raise it: `MS_MAX_UPLOAD_MB=1000`. Also check free disk space. |
| Upload interrupted | Keep the Android browser in the foreground during upload; retry. Large files on weak Wi-Fi may need a second attempt. |
| File not in the receiver list | Tap **Refresh Files** on the KaiOS page (it also auto-refreshes every 30 s when JS is on). Check the upload actually succeeded on Android. |
| Download opens instead of saving | The server sends `Content-Disposition: attachment`, so the KaiOS browser should offer to save. If it still opens, long-press / use the browser's Save option. |
| Port 8080 already in use | Start with another port: `python server.py --port 8081` and use that port in the URL. |
| `pip install` fails | Upgrade pip (`python -m pip install --upgrade pip`) and retry. Python 3.8+ is required. |

## Testing

Verified on the build machine: upload, download, delete and clear all
work through the server. The server was also started on Android via
Termux and was reachable on the LAN.

**Not yet verified:** downloading a file on the real KaiOS E241S
handset — that test is still pending.

Testing checklist:

1. Start the server on a PC.
2. Connect Android + KaiOS to the same Wi-Fi.
3. Open the server URL on Android, upload an image.
4. Open `/receiver` on KaiOS, verify the image appears.
5. Download it and verify the file opens correctly.
6. Repeat with MP3, MP4, PDF, TXT and ZIP.
7. Upload the same filename twice — check it becomes `name_1.ext`.
8. Upload several files at once and check the progress bar.
9. Delete one file, then Clear History, and check the receiver list empties.

## License

Free to use and modify for personal use.
