# Aura — Read the vibe. Catch the static.

Two ways to look at the same chat:

- **🌈 Vibe Check** — what's the actual mood in this conversation?
- **🚩 Red Flag Radar** — does anything in here match scam, manipulation, or fraud patterns?

You pick one lens at a time — no overwhelming checkbox lists. Whichever
track you choose runs its full set of features automatically.

**Privacy note:** all analysis happens client-side in the browser
(`public/js/app.js`). No chat data is ever sent to a server — Flask's
only job here is to serve the page.

---

## Project structure

```
aura/
├── app.py                  ← Flask app (serves the page)
├── requirements.txt
├── .gitignore
├── templates/
│   └── index.html          ← page structure
└── public/                 ← static assets — Vercel serves this directly via CDN
    ├── css/
    │   └── style.css       ← design system (warm gradients, glass cards, 3D tilt)
    └── js/
        └── app.js          ← detection engine + all UI logic
```

> Static files live in `public/` (not the usual `static/`) because that's
> what Vercel's Flask integration expects — it serves everything in
> `public/**` straight from its CDN instead of routing through Flask.

---

## Run it locally

```bash
pip install -r requirements.txt
python app.py
```
Then open **http://127.0.0.1:5000**

---

## Deploy: GitHub → Vercel

**1. Push to GitHub**
```bash
cd aura
git init
git add .
git commit -m "Aura — vibe check & red flag radar"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aura.git
git push -u origin main
```

**2. Import into Vercel**
- Go to [vercel.com](https://vercel.com) → **Add New → Project**
- Select your `aura` GitHub repo
- Vercel auto-detects it as a Flask app (Python runtime) — no extra config needed
- Click **Deploy**

**3. You're live**
Vercel gives you a URL like `aura-yourname.vercel.app` — that's your link for GitHub, your portfolio, or your project submission.

> If Vercel ever doesn't auto-detect Flask, add a `vercel.json` at the
> project root with `{ "framework": "flask" }` and redeploy.

---

## Feature reference

### 🌈 Vibe Check (Track 1)
| Feature | What it does |
|---|---|
| Mood Report | Happy / Sad / Angry / Rude / Love / Truly Caring — per person, as % |
| Statistics | Doughnut chart of overall mood + stacked bar chart per person |
| Search by Vibe | Filter every message by person and/or mood |
| All Messages | Full chat log, mood-tagged |
| Download Report | Plain-text report, one click |

### 🚩 Red Flag Radar (Track 2)
| Feature | What it does |
|---|---|
| Safety Report | Flags messages matching scam/manipulation patterns, with reasons |
| Categories | Manipulation & Pressure, Financial/Prize Scam, OTP/Banking Request, Academic Scam, Authority/Urgency Pressure, Impersonation/Account Takeover, Romance/Catfishing Pattern |
| Trust Score | 0–100 score per contact, combining all flagged signals |
| Vibe Shift Alerts | Flags when a contact's recent tone/pattern differs sharply from their own earlier messages in the chat |
| Link Safety | Flags shortened links, IP-based links, and risky domain endings |
| Safety Tips | Plain-language tip generated for each category actually found |
| Download Report | Plain-text report, one click |

### Shared
- **Voice Check** — speak a message out loud (uses the browser's built-in speech recognition; works best in Chrome) and it gets added to the analysis
- **Signal Trace** — a waveform across the top of the dashboard; stays calm for normal messages, spikes for flagged ones

---

## Notes for your project report

- Detection is **keyword/pattern-based**, not machine learning — this is
  intentional, since it keeps the logic fully explainable for a viva
  ("how does it actually work?" → here's exactly which words triggered it)
- Trust Score and Vibe Shift Alerts are simple, transparent heuristics —
  worth describing honestly as "a nudge to double-check," not a verdict
- Nothing here claims to read minds or accuse real people — every flag is
  framed as a signal worth a closer look
