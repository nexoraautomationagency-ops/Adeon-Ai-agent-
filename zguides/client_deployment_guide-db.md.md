# 🚀 Adeon AI Agent: New Client Deployment Guide

This guide will walk you through the exact steps to create a **100% separated environment** for your new client. They will have their own Database, their own VPS server, and their own Git repository.

---

## Phase 1: Separating the Git Repository

If you want the client to have their own codebase (so you can make custom changes just for them without affecting the main bot), you should create a separate Git repository.

1. Go to your GitHub account and create a **New Private Repository** (e.g., `Adeon-ClientName`).
2. Open your terminal on your local computer, and make a completely fresh clone of your current master code into a new folder:
   ```bash
   git clone https://github.com/nexoraautomationagency-ops/Adeon-Ai-agent-.git ClientName-Bot
   cd ClientName-Bot
   ```
3. Remove the old Git connection and link it to the new repository you just created:
   ```bash
   git remote remove origin
   git remote add origin https://github.com/YOUR_USERNAME/Adeon-ClientName.git
   git branch -M main
   git push -u origin main
   ```
*Now, any code changes you make in this folder will only affect this specific client.*

---

## Phase 2: Setting up Supabase (The Database)

Since you want the client's data completely isolated, they need their own Supabase project.

### Step 2.1: Create the Project
1. Go to [Supabase](https://supabase.com/) and log in.
2. Click **New Project** and select your organization.
3. Name it something like `Adeon-ClientName`.
4. Create a strong Database Password and save it somewhere safe.
5. Select a region closest to Sri Lanka (like Singapore or Mumbai).
6. Click **Create new project** (It will take a few minutes to set up).

### Step 2.2: Get the API Keys
Once the project is ready, you need to get the connection keys for your `.env` file:
1. Go to **Project Settings** (the gear icon at the bottom left) -> **API**.
2. Copy the **Project URL** (This is your `SUPABASE_URL`).
3. Copy the **`anon` `public` API Key** (This is your `SUPABASE_KEY`).

### Step 2.3: Set Up the Storage Bucket (For Tute Photos & Receipts)
Your bot needs a place to save images.
1. On the left menu of Supabase, click **Storage**.
2. Click **New Bucket**.
3. Name the bucket exactly: `receipts` (must be exact!).
4. Make sure to toggle **Public bucket** to ON.
5. Click Save.

*(Note: You do not need to manually create the database tables. Your `migrate.js` script will do that automatically in Phase 3!)*

---

## Phase 3: Setting up the VPS Server

You need a new server to run this client's bot 24/7.

1. Rent a new VPS (from Hostinger, DigitalOcean, AWS, etc.). Ubuntu 22.04 or 24.04 is recommended.
2. Connect to your VPS via SSH:
   ```bash
   ssh root@YOUR_VPS_IP
   ```
3. Update the server and install Node.js & Git:
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git
   ```
4. Install PM2 (This keeps your bot running forever):
   ```bash
   sudo npm install -g pm2
   ```

---

## Phase 4: Deploying the Bot on the VPS

Now, we bring your code into the new VPS and connect it to the new Supabase database.

1. Clone the client's specific Git repository onto the VPS:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Adeon-ClientName.git
   cd Adeon-ClientName
   ```
2. Install all the necessary packages for the backend and frontend:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
3. **Create the `.env` file**. Inside the `server` folder, create your `.env` file:
   ```bash
   cd ../server
   nano .env
   ```
4. Paste the following configuration (replace with the new client's specific keys):
   ```env
   # New Supabase Details
   SUPABASE_URL=https://your-new-project.supabase.co
   SUPABASE_KEY=your-new-anon-key
   
   # AI Details
   OPENAI_API_KEY=your-openai-key
   OPENAI_MODEL=gpt-4o-mini
   
   # Server Details
   PORT=5000
   SESSION_SECRET=a_very_strong_random_secret_string
   ```
   *Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).*

### Step 4.1: Run the Database Migration
Now that the server is connected to the new Supabase, we need to create the tables.
Run your migration script:
```bash
node db/migrate.js
```
*You should see a message saying the database migrated successfully.*

### Step 4.2: Start the Server & WhatsApp
1. Start the server using PM2:
   ```bash
   pm2 start index.js --name "client-bot-server"
   pm2 save
   ```
2. View the logs to scan the WhatsApp QR Code:
   ```bash
   pm2 logs client-bot-server
   ```
   *Ask the client to scan the QR code that appears in the terminal with their business WhatsApp.*

---

## Phase 5: Final Initialization

1. Once the WhatsApp connects, open the Admin Dashboard in your browser (e.g., `http://YOUR_VPS_IP:5000` or whatever port/domain you mapped it to).
2. Because it's a completely fresh database, you will need to create the first admin account.
3. Log in, go to the **Settings** page, and configure the basic details:
   - Institute Name
   - Tutor Name
   - Primary Phone Number
   - Bank Details
4. Build the RAG Knowledge base (Add FAQs, Rules, SOPs) from the Dashboard.

🎉 **Done! The new client is now running on an entirely separate infrastructure.**
