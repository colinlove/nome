# ⏱️ ClockSync Metronome

A web-based metronome synchronized with your device's clock (NTP / GPS / System Time) with a guaranteed **downbeat at :00.000 of every minute**.

Because the metronome is locked to the global wall-clock second rather than an arbitrary play press, multiple devices across different locations and platforms (smartphones, tablets, laptops) can tick and flash in unison without needing local Wi-Fi pairing, Bluetooth, or server websockets.

---

## 🌟 Key Features

1. **Clock Synchronization Engine**:
   - Anchored to device time (`Date.now()`).
   - Every minute starts at `:00.000` with **Beat 1 (Downbeat)**.
   - BPM is strictly an integer, guaranteeing that exactly $N$ beats fit into each 60,000ms minute.
   - High-precision Web Audio API look-ahead scheduler prevents audio jitter or drift.

2. **Visual Cues**:
   - **Full-Screen Beat Strobe**: Flashes the entire screen on each beat with a smooth fade; distinct accent color for Beat 1. Switchable between Light and Dark mode.
   - **Bouncing Ball Visualizer**: Parabolic gravity physics with squash-and-stretch and impact ripples across beat pads. Ideal for faster tempos ($\ge 100$ BPM).
   - **Circular Progress Visualizer**: Radial sweep indicator with segmented beat rings and remaining millisecond countdown. Ideal for slower tempos ($< 100$ BPM).
   - **Auto-Switching or Manual Tabs**: Automatically chooses Bouncing Ball for fast tempos and Circular Progress for slow tempos, with manual override tabs (Ball, Circle, Both).
   - **Beat Bead Indicators**: Visual bar indicators highlighting the active beat and downbeat.

3. **Tempo & Meter Controls**:
   - Default tempo: **120 BPM**.
   - Increments: **+1 / -1** and **+5 / -5** nudge buttons, interactive slider, and direct number input.
   - Time signatures: **3/4** (Waltz), **4/4** (Common), and **6/8** (Compound).
   - Keyboard shortcuts: `Space` (Start/Stop), `Left/Right` ($\pm 1$ BPM), `Up/Down` ($\pm 5$ BPM).

4. **Advanced Tools**:
   - **Tap Tempo**: Tap along to calculate and lock onto integer BPM.
   - **Sound Palette**: Acoustic Woodblock, Digital Beep, Mechanical Metronome, Drum/Rimshot, or Mute (Visual-only).
   - **Latency Calibration Offset**: Nudge audio by $\pm 10\text{ms}$ to compensate for Bluetooth headphone latency or hardware audio delays.
   - **Live Sync Diagnostics**: Live device wall-clock readout down to milliseconds, elapsed minute progress, beat index within minute, and countdown to next guaranteed downbeat.

---

## 🚀 How to Deploy to Vercel

Vercel is the recommended hosting platform for ClockSync Metronome because it provides free global Edge CDN distribution and instant HTTPS.

### Method 1: Deploy with Vercel Web Dashboard (Easiest, No CLI Required)

1. **Upload your code to GitHub**:
   - Initialize git in this folder:
     ```bash
     git init
     git add .
     git commit -m "Initial commit of ClockSync Metronome"
     ```
   - Create a new public or private repository on [GitHub](https://github.com/new).
   - Link and push your repository:
     ```bash
     git remote add origin https://github.com/<your-username>/<repo-name>.git
     git branch -M main
     git push -u origin main
     ```

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in (or sign up with GitHub).
   - Click **"Add New..."** → **"Project"**.
   - Select your GitHub repository from the list and click **"Import"**.
   - **Framework Preset**: Select **"Other"** (or leave as default, Vercel will automatically detect the static HTML/CSS/JS).
   - Leave the build command and output directory empty.
   - Click **"Deploy"**.
   - In less than 15 seconds, your app will be live at `https://<project-name>.vercel.app`!

---

### Method 2: Deploy using Vercel CLI

If you have Node.js and the Vercel CLI installed:

1. Install the Vercel CLI globally (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Run the deploy command from this folder:
   ```bash
   vercel
   ```
   - Follow the simple interactive prompts:
     - *Set up and deploy?* `Y`
     - *Which scope?* (Select your account)
     - *Link to existing project?* `N`
     - *Project name?* `clocksync-metronome` (or press Enter)
     - *Directory?* `./` (press Enter)
     - *Override settings?* `N`

3. To deploy directly to production:
   ```bash
   vercel --prod
   ```

---

## 🌐 Alternative Deployment Options

### 1. Netlify
- **Drag-and-Drop**: Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the entire project folder directly into your browser window. Your site is live immediately.
- **Git Push**: Connect your GitHub repository to Netlify with publish directory set to `./`.

### 2. GitHub Pages
1. Push this project to a GitHub repository.
2. In your GitHub repo, go to **Settings** → **Pages**.
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Select `main` branch and `/ (root)` folder, then click **Save**.
5. Your site will be published at `https://<username>.github.io/<repo-name>/`.

### 3. Cloudflare Pages
1. Go to Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages**.
2. Connect your Git repository.
3. Build command: None, Output directory: `./`.
4. Deploy!

---

## 🛠️ Local Development & Testing

To test or run locally without installing any web server:
- With **Python**:
  ```bash
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in your browser.

---

## 💡 How Multiple Device Sync Works

1. **Network Time Protocol (NTP)**: Operating systems (iOS, Android, macOS, Windows, Linux) automatically sync their internal clocks with global time servers via NTP.
2. **Deterministic Beat Grid**: At tempo $B$, each beat occurs at:
   $$T_k = M_0 + k \times \frac{60000}{B}$$
   where $M_0$ is the start of the current minute ($t - (t \pmod{60000})$) and $k \in \{0, 1, \dots, B - 1\}$.
3. At second `:00.000` of every minute ($k = 0$), $k \pmod{\text{beatsPerBar}} = 0$, guaranteeing a downbeat on Beat 1.
4. Two different devices with accurate system time will compute the exact same beat and phase down to the millisecond.
