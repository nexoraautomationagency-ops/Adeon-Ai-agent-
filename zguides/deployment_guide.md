# 🚀 Adeon AI Agent — Complete VPS Deployment Guide

> **This guide assumes:** Ubuntu 22.04/24.04 VPS (DigitalOcean, Hostinger, Contabo, etc.)  
> **AI Provider:** OpenAI (GPT-4o-mini)  
> **Time needed:** ~45 minutes  
> **Difficulty:** Copy-paste every command, no Linux experience needed

---

## PHASE 1: Buy a VPS & Connect

### Step 1.1 — Buy a VPS

Go to any of these providers and buy the cheapest VPS:

| Provider | Recommended Plan | Price |
|----------|-----------------|-------|
| [Hostinger VPS](https://hostinger.com) | KVM 1 (1 vCPU, 4GB RAM) | ~$5/mo |
| [Contabo](https://contabo.com) | Cloud VPS S (4 vCPU, 8GB RAM) | ~$7/mo |
| [DigitalOcean](https://digitalocean.com) | Basic Droplet (2GB RAM) | ~$12/mo |

> [!IMPORTANT]
> **Minimum specs:** 2GB RAM, 1 vCPU, 20GB disk. WhatsApp-Web.js runs a hidden Chrome browser — it needs at least 2GB RAM.

Choose **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** as the OS.

After purchase, you'll get:
- **IP Address** (e.g., `167.99.123.45`)
- **Root Password** or SSH key

### Step 1.2 — Connect to Your VPS

Open **PowerShell** on your Windows PC and run:

```powershell
ssh root@YOUR_SERVER_IP
```

Type `yes` when asked, then enter your password.

> [!TIP]
> If you see `root@server:~#` — you're in! Every command from here runs on the VPS.

---

## PHASE 2: Install Everything on the VPS

### Step 2.1 — Update the system

```bash
apt update && apt upgrade -y
```

### Step 2.2 — Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify:
```bash
node -v
npm -v
```

You should see `v20.x.x` and `10.x.x`.

### Step 2.3 — Install Chrome/Chromium dependencies (for WhatsApp-Web.js)

This is **critical** — WhatsApp-Web.js uses Puppeteer which needs a headless Chrome browser:

```bash
apt install -y \
  gconf-service libgbm-dev libasound2t64 libatk1.0-0t64 libc6 libcairo2 \
  libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgcc-s1 \
  libgconf-2-4 libgdk-pixbuf-2.0-0 libglib2.0-0t64 libgtk-3-0t64 \
  libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
  libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libnss3 lsb-release xdg-utils wget chromium-browser
```

> [!NOTE]
> If `chromium-browser` fails, try `apt install -y chromium` instead. On some Ubuntu versions the package name differs.

### Step 2.4 — Install PM2 (Process Manager)

```bash
npm install -g pm2
```

### Step 2.5 — Install Nginx (Web Server / Reverse Proxy)

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### Step 2.6 — Install Git

```bash
apt install -y git
```

---

## PHASE 3: Upload Your Project

### Option A — Using Git (Recommended)

If your code is on GitHub:

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/Adeon-Ai-agent-.git adeon
cd adeon
```

### Option B — Using SCP (Upload from your PC)

On your **Windows PC** (PowerShell), run:

```powershell
scp -r "D:\Adeon ai agent\*" root@YOUR_SERVER_IP:/var/www/adeon/
```

Then on the VPS:

```bash
cd /var/www/adeon
```

### Step 3.1 — Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### Step 3.2 — Create Required Directories

```bash
mkdir -p logs
mkdir -p .wwebjs_auth
```

---

## PHASE 4: Configure .env for Production

### Step 4.1 — Generate a Strong JWT Secret

Run this command and **copy the output**:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

It will print something like:
```
a3f7c9d2e1b4...very_long_random_string...8c6d2f1a
```

**Copy this entire string.**

### Step 4.2 — Create the Production .env File

```bash
nano .env
```

Paste this **entire block**:

```env
# ==========================================
# SERVER CONFIGURATION
# ==========================================
PORT=3001
NODE_ENV=production
JWT_SECRET=PASTE_THE_64_CHAR_STRING_YOU_JUST_GENERATED
CLIENT_URL=http://YOUR_SERVER_IP

# ==========================================
# AI CONFIGURATION — OpenAI GPT-4o-mini
# ==========================================
AI_PROVIDER=openai

OPENAI_API_KEY=sk-proj-YOUR_OPENAI_API_KEY_HERE
OPENAI_MODEL=gpt-4o-mini

# Fallback (OpenRouter) — only used if OpenAI fails
OPENROUTER_API_KEY=sk-or-v1-YOUR_OPENROUTER_KEY_HERE
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# --- AI PERFORMANCE ---
AI_MAX_TOKENS=800
AI_CACHE_EXPIRY=24
USE_MOCK_AI=false

# ==========================================
# WHATSAPP & DATABASE
# ==========================================
WA_SESSION_PATH=./.wwebjs_auth
ADMIN_PHONE=94720592637

# Supabase Configuration
SUPABASE_URL=https://mqfjkeqcwsauiqmsjazb.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY_HERE
DATABASE_URL=postgresql://postgres.mqfjkeqcwsauiqmsjazb:YOUR_PASSWORD_HERE@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres

# ==========================================
# Master Security
# ==========================================
REGISTRATION_KEY=ADEON_SECRET_2026
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`.

> [!CAUTION]
> **THREE things you MUST change in the block above:**
> 1. `JWT_SECRET` → Paste the random string from Step 4.1
> 2. `OPENAI_API_KEY` → Your real OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
> 3. `CLIENT_URL` → Replace `YOUR_SERVER_IP` with your actual server IP (e.g., `http://167.99.123.45`)

---

## 📖 Understanding AI_MAX_TOKENS

`AI_MAX_TOKENS=800` controls the **maximum length of every AI reply**.

### What are tokens?
Tokens are how OpenAI measures text. Roughly:
- **1 token ≈ 4 characters** in English
- **1 token ≈ 1-2 characters** in Sinhala/Unicode
- **800 tokens ≈ about 200-300 words** in English

### What does this setting do?

| Value | Effect | Cost per message |
|-------|--------|-----------------|
| `400` | Very short replies only (1-2 sentences). Cheapest. | ~$0.00006 |
| `800` | **Recommended.** Natural reply length for admin chat. Good balance. | ~$0.00012 |
| `1200` | Longer replies. Good for detailed schedule/payment info. | ~$0.00018 |
| `2000` | Very long replies. Usually unnecessary for your chatbot. Expensive. | ~$0.00030 |

### Why 800 is perfect for your system:
- Your AI is an admin bot — it sends SHORT Singlish replies like "Hari 😊 ඔයාගේ Grade එක මොකක්ද"
- Registration confirmation messages with bank details are the longest (~150 words) and 800 tokens covers them perfectly
- Going higher wastes money with no benefit since your system prompt tells the AI to keep replies under 25 words

### Cost math with GPT-4o-mini:
- **Input:** $0.15 per 1M tokens (your system prompt + student message)
- **Output:** $0.60 per 1M tokens (the AI reply)
- **Per message:** ~$0.0001-0.0003 (less than 1 cent per 30 messages)
- **100 students × 5 messages/day = ~$0.50-1.50/month**

> [!TIP]
> If your monthly bill goes above $5, lower `AI_MAX_TOKENS` to `600`. The AI will still work fine — your prompts already tell it to reply in under 25 words.

---

## 📖 Understanding the Domain Situation

### Option 1: No Domain (Just IP Address) — Works Right Now

You can access your system immediately at:
```
http://167.99.123.45
```

**Pros:** Free, instant, no setup needed  
**Cons:** Hard to remember, no HTTPS/SSL, looks unprofessional

This is **perfectly fine for starting**. You can add a domain later.

### Option 2: Buy a Domain — Professional Setup

A domain lets you access your system at something like:
```
https://admin.adeonscience.lk
```

**Steps to set up a domain:**

#### 1. Buy a domain (~$10/year)
- [Namecheap](https://namecheap.com) — `.com` domains for ~$10/yr
- [nic.lk](https://nic.lk) — `.lk` domains for Sri Lanka (~LKR 3000/yr)
- [GoDaddy](https://godaddy.com) — another option

#### 2. Point the domain to your VPS
After buying, go to the domain provider's **DNS settings** and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_SERVER_IP` | 3600 |
| A | `www` | `YOUR_SERVER_IP` | 3600 |

> `@` means the root domain (e.g., `adeonscience.lk`)  
> `www` means `www.adeonscience.lk`

**Wait 5-30 minutes** for DNS to propagate.

#### 3. Update Nginx config
```bash
nano /etc/nginx/sites-available/adeon
```
Change the `server_name` line:
```nginx
server_name adeonscience.lk www.adeonscience.lk;
```
```bash
nginx -t && systemctl restart nginx
```

#### 4. Get free SSL (HTTPS)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d adeonscience.lk -d www.adeonscience.lk
```

#### 5. Update .env
```bash
nano /var/www/adeon/.env
```
Change:
```env
CLIENT_URL=https://adeonscience.lk
```
```bash
pm2 restart adeon-ai
```

Now your system runs at `https://adeonscience.lk` with a green lock 🔒

> [!TIP]
> **You DON'T need a domain to deploy.** Start with the IP address, test everything, and add a domain later whenever you want.

---

## PHASE 5: Build & Start

### Step 5.1 — Run Database Migration

```bash
npm run setup
```

You should see:
```
✅ Connected to Supabase PostgreSQL
✅ Supabase Database migrated successfully
```

> [!WARNING]
> If you see connection errors, double-check your `SUPABASE_URL`, `SUPABASE_KEY`, and `DATABASE_URL` in `.env`.

### Step 5.2 — Build the Frontend

```bash
npm run build:client
```

This compiles the React dashboard into `client/dist/`. It takes ~30 seconds.

You should see:
```
vite v8.x.x building for production...
✓ xxx modules transformed.
dist/index.html   xxx kB
```

### Step 5.3 — Test Run (Quick Check)

Before setting up PM2, do a quick test:

```bash
node server/index.js
```

You should see:
```
╔══════════════════════════════════════════════╗
║     🎓 Tutor WhatsApp SaaS Platform         ║
║     Server running on port 3001              ║
╚══════════════════════════════════════════════╝
[WhatsApp] 🚀 Initializing with Master Guard...
```

Wait ~30 seconds. If you see `[WhatsApp] Creating new client...` — it's working.

Press `Ctrl+C` to stop.

### Step 5.4 — Start with PM2 (Permanent)

```bash
pm2 start ecosystem.config.js --env production
```

You should see a table like:
```
┌─────┬──────────┬─────────────┬─────────┬──────────┐
│ id  │ name     │ mode        │ status  │ cpu      │
├─────┼──────────┼─────────────┼─────────┼──────────┤
│ 0   │ adeon-ai │ fork        │ online  │ 0%       │
└─────┴──────────┴─────────────┴─────────┴──────────┘
```

### Step 5.5 — Make PM2 Start on Server Reboot

```bash
pm2 save
pm2 startup
```

PM2 will print a command like:
```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

**Copy that exact command and run it.** This ensures your app survives server reboots.

---

## PHASE 6: Set Up Nginx Reverse Proxy

Right now your app runs on port 3001. Nginx will route port 80 (HTTP) to it so users can access `http://YOUR_IP` directly without typing `:3001`.

### Step 6.1 — Create Nginx Config

```bash
nano /etc/nginx/sites-available/adeon
```

Paste this:

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;
    # If you have a domain later, change to: server_name adeonscience.lk www.adeonscience.lk;

    # Frontend + API
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # File upload size (for receipt images)
    client_max_body_size 10M;
}
```

Save: `Ctrl+X` → `Y` → `Enter`.

**Replace `YOUR_SERVER_IP`** with your actual IP (e.g., `167.99.123.45`).

### Step 6.2 — Enable the Config

```bash
ln -s /etc/nginx/sites-available/adeon /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
```

### Step 6.3 — Test & Restart Nginx

```bash
nginx -t
```

If it says `syntax is ok, test is successful`:

```bash
systemctl restart nginx
```

### Step 6.4 — Open Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

Type `y` to confirm.

### Step 6.5 — Test It!

Open your browser and go to:

```
http://YOUR_SERVER_IP
```

You should see the Adeon login page! 🎉

---

## PHASE 7: First WhatsApp Connection (QR Scan)

### Step 7.1 — Create Your Admin Account

If this is your first deployment, register:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Adeesha",
    "email": "your-email@gmail.com",
    "password": "your-strong-password",
    "phone": "94720592637",
    "institute_name": "Adeon Science Academy",
    "registration_key": "ADEON_SECRET_2026"
  }'
```

> [!IMPORTANT]
> Change the `email`, `password`, and `phone` to your real details. The `registration_key` must match what's in your `.env`.

### Step 7.2 — Login & Scan QR

1. Open `http://YOUR_SERVER_IP` in your browser
2. Login with the email/password you just registered
3. Go to the **WhatsApp** section in the dashboard
4. A QR code will appear — **scan it with your WhatsApp phone**

### Step 7.3 — Verify Connection

```bash
pm2 logs adeon-ai --lines 10
```

Look for: `[WhatsApp] ✅ Ready`

### Step 7.4 — Backup the WhatsApp Session

**Do this immediately after connecting:**

```bash
cp -r /var/www/adeon/.wwebjs_auth /var/www/adeon/.wwebjs_auth_backup
```

This backup means you can restore the session if it gets corrupted, avoiding a re-scan.

---

## PHASE 8: Final Verification

Run these checks:

```bash
# 1. App is running
pm2 status
# → Should show "online"

# 2. Health check
curl http://localhost:3001/api/health
# → Should return {"status":"ok","whatsapp":"ready",...}

# 3. WhatsApp connected
pm2 logs adeon-ai --lines 5
# → Should show "[WhatsApp] ✅ Ready"

# 4. Nginx working
curl -I http://YOUR_SERVER_IP
# → Should return "HTTP/1.1 200 OK"
```

If all 4 pass — **your system is fully deployed!** 🎉

---

## 📋 Daily Commands Cheatsheet

| What | Command |
|------|---------|
| Check status | `pm2 status` |
| View logs | `pm2 logs adeon-ai` |
| Restart app | `pm2 restart adeon-ai` |
| Stop app | `pm2 stop adeon-ai` |
| Memory usage | `pm2 monit` |
| Health check | `curl http://localhost:3001/api/health` |
| Edit config | `nano /var/www/adeon/.env` (then `pm2 restart adeon-ai`) |
| Update code | `cd /var/www/adeon && git pull && npm run build:client && pm2 restart adeon-ai` |
| Run migration | `cd /var/www/adeon && npm run setup` |
| Nginx restart | `systemctl restart nginx` |
| Backup WA | `cp -r .wwebjs_auth .wwebjs_auth_backup` |
| Restore WA | `cp -r .wwebjs_auth_backup .wwebjs_auth && pm2 restart adeon-ai` |

### If WhatsApp Disconnects

```bash
# Usually a simple restart fixes it — session loads from disk
pm2 restart adeon-ai

# If that doesn't work, restore the backup
cd /var/www/adeon
rm -rf .wwebjs_auth
cp -r .wwebjs_auth_backup .wwebjs_auth
pm2 restart adeon-ai

# If backup also fails — re-scan QR from the dashboard
```

### Updating Code (When You Push Changes)

```bash
cd /var/www/adeon
git pull origin main
npm install
cd client && npm install && cd ..
npm run build:client
npm run setup
pm2 restart adeon-ai
```
