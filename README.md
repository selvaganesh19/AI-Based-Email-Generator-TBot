# 📬 Telegram AI Email Bot

A powerful Telegram bot to generate, schedule, and send emails using **Cohere AI** and **Gmail API**, complete with file attachment support, reminders, and Render deployment support.

👉 **Try the bot on Telegram**: [@email_chatbot](https://t.me/email_chatbot)

---

## ✨ Features

- 🤖 AI-generated emails (based on role, tone, topic)
- 📎 Upload and attach files directly in chat     
- ⏰ Schedule emails or send them instantly
- 🔔 `/remindme` command to email yourself reminders
- 🛡 Gmail API via OAuth2 with secure Base64 credentials
- 🚀 Deployable on [Render](https://render.com)

---

## 📁 Project Structure

Email-Chat-Bot/
├── bot.js # Telegram bot logic
├── gmail.js # Gmail + AI integration
├── downloads/ # Temp storage for file uploads             99999999999999999999999
├── .env # Environment config (local use)
└── README.md # This file


---

## 🧪 Local Setup

### 1. Clone and Install

git clone https://github.com/YOUR_USERNAME/Email-Chat-Bot.git
cd Email-Chat-Bot
npm install

2. Create .env File

TELEGRAM_TOKEN=your_telegram_bot_token
COHERE_API_KEY=your_cohere_api_key

3. Gmail API Setup

  # Go to Google Cloud Console

  # Enable Gmail API

  # Create OAuth 2.0 credentials (Desktop App)

  # Download credentials.json into root folder

  # Run once to authenticate:
        node bot.js

☁️ Deploy on Render
1. Convert JSON files to base64

base64 credentials.json > credentials.txt
base64 token.json > token.txt

2. Set Render Environment Variables

| Key                       | Value                        |
| ------------------------- | ---------------------------- |
| `TELEGRAM_TOKEN`          | Your Telegram Bot Token      |
| `COHERE_API_KEY`          | Your Cohere API Key          |
| `CREDENTIALS_JSON_BASE64` | Content of `credentials.txt` |
| `TOKEN_JSON_BASE64`       | Content of `token.txt`       |

3. Start Command

node bot.js

📌 Bot Commands
/start – Compose AI-powered Email
Role → Tone → Topic → Subject → Recipient → Files → Send Time

/remindme – Schedule a Reminder Email
🛠 Tech Stack
🧠 Cohere AI – AI email writing

📧 Gmail API

🤖 node-telegram-bot-api

☁️ Render

🔐 Security
No JSON files in GitHub

Gmail token & credentials injected via Base64 environment variables

OAuth2 used for secure Gmail access

📄 License
MIT © 2025 [selvaganesh19]

🙋 Support
Open an issue or reach out on Telegram if you need help!


---

### ✅ What You Should Do:
- Replace `YOUR_USERNAME` with your actual GitHub username (`selvaganesh19`).
- Update the author name in the license section.

Let me know if you'd like me to generate a `render.yaml` or GitHub badges for your project.

