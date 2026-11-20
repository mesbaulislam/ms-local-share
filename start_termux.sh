#!/data/data/com.termux/files/usr/bin/bash
# MS Local Transfer - Android (Termux) starter
# First time:  pkg install python -y   (once, in Termux)
# Then run:    bash start_termux.sh
# The server prints the LAN address - open it on the KaiOS phone.
cd "$(dirname "$0")" || exit 1
mkdir -p uploads
python -c "import flask" 2>/dev/null || pip install -r requirements.txt
python server.py
