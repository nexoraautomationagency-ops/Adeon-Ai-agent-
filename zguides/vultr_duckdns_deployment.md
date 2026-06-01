# 🚀 Adeon AI Agent — Vultr + DuckDNS Deployment Guide

This guide provides a step-by-step walkthrough to deploy your **Adeon AI Agent** to a **Vultr VPS** using a **DuckDNS subdomain**.

> [!IMPORTANT]
> **Recommended VPS Specs:** 1 vCPU, 2GB RAM (Vultr Cloud Compute - $12/mo plan is recommended because WhatsApp uses a hidden Chrome browser which requires at least 2GB RAM).

---

## Phase 1: Infrastructure Setup

### Step 1.1: Create Vultr VPS
1. Log in to [Vultr.com](https://www.vultr.com/).
2. Click **Deploy +** → **Deploy New Server**.
3. **Server Type**: Cloud Compute.
4. **Server Location**: Choose the one closest to you or your users (e.g., Singapore or Mumbai).
5. **Operating System**: **Ubuntu 24.04 LTS** (or 22.04).
6. **Server Size**: Select the **$12/mo** plan (2 GB RAM, 1 vCPU). *Don't use the $6 plan as it may crash during QR code generation.*
7. **Additional Features**: Enable **IPv6** (optional but good).
8. **Hostname**: `adeon-server`
9. Click **Deploy Now**.

### Step 1.2: Setup DuckDNS Subdomain
1. Go to [duckdns.org](https://www.duckdns.org/).
2. Log in with any provider (Google, GitHub, etc.).
3. Under **subdomains**, enter a name (e.g., `adeon-ai`) and click **add domain**.
4. You will now have a domain like `adeon-ai.duckdns.org`.
5. Copy your **Token** (found at the top of the DuckDNS page).
6. Click the **update ip** button next to your subdomain to point it to your current computer's IP (we will update it to the VPS IP in the next phase).

---

## Phase 2: Server Preparation

### Step 2.1: Connect to VPS
Open **PowerShell** or **Command Prompt** on your Windows PC:
```powershell
ssh root@YOUR_VULTR_IP
```
*Replace `YOUR_VULTR_IP` with the IP provided by Vultr. Type `yes` and enter your root password.*

### Step 2.2: Update System & Install Essentials
Run these commands one by one:
```bash
apt update && apt upgrade -y
apt install -y git curl wget build-essential nano
```

### Step 2.3: Point DuckDNS to VPS
Run this command on your VPS to immediately point your DuckDNS subdomain to the VPS IP:
```bash
curl "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip="
```
*Replace `YOUR_SUBDOMAIN` (e.g., `adeon-ai`) and `YOUR_TOKEN` with your DuckDNS details.*

### Step 2.4: Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Step 2.5: Install WhatsApp Dependencies (Crucial)
WhatsApp-Web.js needs a browser. Install these system libraries:
```bash
apt install -y \
  libgbm-dev libasound2t64 libatk1.0-0t64 libc6 libcairo2 \
  libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgcc-s1 \
  libgdk-pixbuf-2.0-0 libglib2.0-0t64 libgtk-3-0t64 \
  libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
  libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libnss3 lsb-release xdg-utils wget chromium-browser
```

---

## Phase 3: Project Deployment

### Step 3.1: Clone the Repository
```bash
cd /var/www
git clone https://github.com/nexoraautomationagency-ops/Adeon-Ai-agent-.git adeon
cd adeon
```

### Step 3.2: Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### Step 3.3: Configure Environment Variables
Create the production `.env` file:
```bash
nano .env
```
Paste the following and update the values:
```env
PORT=3001
NODE_ENV=production
# Generate a secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=PASTE_A_LONG_RANDOM_STRING_HERE
CLIENT_URL=https://your-subdomain.duckdns.org

# AI CONFIGURATION
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxx...
OPENAI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=800

# WHATSAPP
ADMIN_PHONE=94720592637
WA_SESSION_PATH=./.wwebjs_auth

# DATABASE (Supabase)
SUPABASE_URL=https://mqfjkeqcwsauiqmsjazb.supabase.co
SUPABASE_KEY=your_supabase_anon_key
DATABASE_URL=postgresql://postgres.mqfjkeqcwsauiqmsjazb:your_password@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres

# SECURITY
REGISTRATION_KEY=ADEON_SECRET_2026
```
*Save: `Ctrl+O`, `Enter`, `Ctrl+X`.*

---

## Phase 4: Web Server & SSL Setup

### Step 4.1: Install Nginx & Certbot
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### Step 4.2: Configure Nginx
```bash
nano /etc/nginx/sites-available/adeon
```
Paste this configuration:
```nginx
server {
    listen 80;
    server_name your-subdomain.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    client_max_body_size 20M;
}
```
*Save and Exit.*

### Step 4.3: Enable Config & Get SSL
```bash
ln -s /etc/nginx/sites-available/adeon /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Get Free SSL Certificate (HTTPS)
certbot --nginx -d your-subdomain.duckdns.org
```
*Follow prompts: enter email, agree to terms, and choose '2' to redirect HTTP to HTTPS.*

---

## Phase 5: Build & Launch

### Step 5.1: Build Frontend & Database
```bash
# Build the dashboard
npm run build:client

# Run database migrations
npm run setup
```

### Step 5.2: Start with PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```
*Run the command `pm2 startup` gives you (it starts with `sudo env...`).*

### Step 5.3: Setup DuckDNS Auto-Update (Cron)
VPS IPs rarely change, but this ensures your domain stays active:
```bash
mkdir ~/duckdns
nano ~/duckdns/duck.sh
```
Paste this (replace details):
```bash
echo url="https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
```
Make it executable and add to crontab:
```bash
chmod 700 ~/duckdns/duck.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

---

## Phase 6: Connection & Usage

1. **Visit your site**: `https://your-subdomain.duckdns.org`
2. **Register Admin**: Open the registration page and create your account using your `REGISTRATION_KEY`.
3. **Link WhatsApp**:
   - Go to the **WhatsApp** tab.
   - Wait for the QR code to load.
   - Scan it with your phone.
4. **Monitor**:
   - Check logs: `pm2 logs adeon-ai`
   - Check status: `pm2 status`

### Updating Your App
When you push new changes to GitHub, run this on the VPS:
```bash
cd /var/www/adeon
git pull origin main
npm install
npm run build:client
pm2 restart adeon-ai
```

---
**Congratulations! Your Adeon AI Agent is now live and secured.** 🚀
