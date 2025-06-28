# 📧 Telegram AI Email Bot (Cohere + Gmail API)

A Telegram bot that writes, schedules, and sends emails using **Cohere AI** for content generation and **Gmail API** for delivery.

---

## 🚀 Features

✅ AI-generated emails (role, tone, topic)  
✅ Gmail API integration (OAuth2)  
✅ File attachment support  
✅ Email scheduling (`now` or future time)  
✅ `/remindme` command for sending reminders  
✅ Inline UX with tone and confirmation buttons  
✅ Render-ready deployment with secure base64 credentials  

---

## 📁 File Structure

Email-Chat-Bot/
├── bot.js # Telegram bot logic
├── gmail.js # Gmail + Cohere integration
├── downloads/ # Temporary attachment storage
├── .env # Local environment variables
└── README.md # This file

---

## 🧪 Local Development

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/Email-Chat-Bot.git
cd Email-Chat-Bot

2. Install Dependencies

npm install

3. Setup .env
Create a .env file with:

TELEGRAM_TOKEN=your_telegram_bot_token
COHERE_API_KEY=your_cohere_api_key

4. Setup Gmail API

Go to Google Cloud Console

Enable Gmail API under APIs & Services

Create OAuth 2.0 Credentials (Desktop App)

Download credentials.json and place it in the root folder

Then run once to authorize Gmail:

node bot.js
This will open a URL and ask for an auth code → saves token.json locally.

☁️ Render Deployment (No .json Uploads Needed)
1. Convert Credential Files to Base64

base64 credentials.json > credentials.txt
base64 token.json > token.txt
Copy the contents of those .txt files.

2. Set Render Environment Variables
In your Render Web Service, add the following under "Environment":

Key	Value (Paste contents)
TELEGRAM_TOKEN	Your Telegram Bot Token
COHERE_API_KEY	Your Cohere API Key
CREDENTIALS_JSON_BASE64	Output of credentials.txt
TOKEN_JSON_BASE64	Output of token.txt

3. Start Command
Set this in Render Start Command:

node bot.js
Render will now decode and create the credentials.json and token.json files automatically at runtime using this snippet inside bot.js:

if (process.env.TOKEN_JSON_BASE64 && !fs.existsSync(tokenPath)) {
  fs.writeFileSync(tokenPath, Buffer.from(process.env.TOKEN_JSON_BASE64, 'base64'));
}
if (process.env.CREDENTIALS_JSON_BASE64 && !fs.existsSync(credentialsPath)) {
  fs.writeFileSync(credentialsPath, Buffer.from(process.env.CREDENTIALS_JSON_BASE64, 'base64'));
}
✉️ Bot Commands
/start
Begin writing an AI-generated email. The bot will ask:

What’s your role? (e.g., Student, Developer)

Pick tone: Formal / Casual

Topic of the email

Subject (or type auto)

Recipient email

Attach files (optional)

Send now or schedule

/remindme
Schedule a personal reminder email to yourself.

📦 Example Usage
Step-by-step:

/start

🧑 Bot asks for your role → Student

✉️ Choose tone → Formal

📝 Enter topic → Internship Application

📌 Enter subject → auto

📬 Recipient email → example@gmail.com

📎 Upload files (or skip)

📅 Enter send time → now or 2025-07-01 12:00

✅ Confirm email → Bot sends via Gmail!

📚 Powered By
Cohere AI – For generating email text (command model)

Gmail API – For sending emails (with OAuth2)

node-telegram-bot-api – Telegram Bot wrapper

Render – For hosting the Node.js bot

🛡 Security
No .json secrets committed to GitHub

All credentials are injected via Render Env Vars using Base64

OAuth2 token never exposed publicly

📄 License
MIT © 2025 [Your Name]

🙋 Need Help?
Cohere API Docs

Gmail API Docs

Render Docs

If you face issues, feel free to open a GitHub Issue or ping me.

---

Let me know if you’d like me to:
- Include a `render.yaml` for auto-deploy
- Add badges (e.g. Telegram, Render deploy)
- Fill in your real GitHub repo name and author details.
