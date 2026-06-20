"""
Aura — Flask app
==================
All chat analysis runs client-side in the browser (public/js/app.js) —
no chat data is ever sent to this server. Flask's only job here is to
serve the page itself.

Run locally:  python app.py   →  http://127.0.0.1:5000
"""

from flask import Flask, render_template

# static_folder='public', static_url_path='' makes Flask serve files from
# public/ at the site root (e.g. public/css/style.css -> /css/style.css)
# both locally AND on Vercel, where public/** is served directly via CDN.
app = Flask(__name__, static_folder="public", static_url_path="")


@app.route("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
