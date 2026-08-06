# the-bookshelf
Simple self-hosted digital bookshelf for reading PDF's for any device.

# Features
```text
- Reading without downloading
- Self Host anywhere
- Works on desktop and mobile
```

# Tech Stack
```text
- HTML
- JS
- Flask (Python) for backend
```

# Structure
```text
the-bookshelf/
├── books/
├── css/
├── covers/
├── index.html
└── README.md
```

# Dependencies
```text
python3 -m venv venv
source venv/bin/activate
pip install pymupdf
pip install flask
```

# Running
The server listens on all interfaces on port 80. Port 80 is privileged, so run as root:
```text
sudo venv/bin/python server.py
```
Then open `http://localhost/` (or the machine's IP from another device).

Anyone with access can add a book with the **+ Publish** button in the top bar — it uploads a PDF, saves it to `books/`, and generates its cover automatically.

# Exposing it to the public internet
By default the server is only reachable on your local network. To let anyone reach it:

**Open port 80 on your machine's firewall.**
   ```text
   sudo ufw allow 80/tcp
