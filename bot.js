const fs = require('fs');
const path = require('path');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const schedule = require('node-schedule');
const express = require('express');
const { sendGmail, recommendSubject, generateEmail } = require('./gmail');

// Decode and save token/credentials from base64 if not present
const tokenPath = path.join(__dirname, 'token.json');
const credentialsPath = path.join(__dirname, 'credentials.json');

if (process.env.TOKEN_JSON_BASE64 && !fs.existsSync(tokenPath)) {
  fs.writeFileSync(tokenPath, Buffer.from(process.env.TOKEN_JSON_BASE64, 'base64'));
  console.log('✅ token.json created from env var');
}
if (process.env.CREDENTIALS_JSON_BASE64 && !fs.existsSync(credentialsPath)) {
  fs.writeFileSync(credentialsPath, Buffer.from(process.env.CREDENTIALS_JSON_BASE64, 'base64'));
  console.log('✅ credentials.json created from env var');
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const sessions = {};

const ensureTempDir = () => {
  const dir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return dir;
};

// /start - starts a new email session
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (sessions[chatId]) {
    bot.sendMessage(chatId, '⚠️ You already started a session. Type /cancel to restart.');
    return;
  }
  sessions[chatId] = { mode: 'email', step: 0, data: {}, attachments: [] };
  bot.sendMessage(chatId, '👋 What is your role (e.g., Developer, Student)?');
});

// /cancel - cancels current session
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  delete sessions[chatId];
  bot.sendMessage(chatId, '❌ Session cancelled. Type /start to begin again.');
});

// /remindme - starts reminder flow
bot.onText(/\/remindme/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { mode: 'reminder', step: 0, data: {} };
  bot.sendMessage(chatId, '🔔 What should I remind you about?');
});

// Inline button handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const session = sessions[chatId];
  if (!session) return;

  const data = query.data;

  if (data === 'done_upload') {
    session.awaitingAttachments = false;
    session.step++;
    bot.sendMessage(chatId, '📅 When should I send the email? Type `now` or a time like `2025-07-01 12:00`');
  }

  if ((data === 'Formal' || data === 'Casual') && session.step === 2) {
    session.data.tone = data;
    session.step = 3;
    bot.sendMessage(chatId, `📝 What is the topic of the email? (Tone: ${data})`);
  }

  if (data === 'confirm_send_now') {
    const { data, finalSubject, generatedEmail, attachments, sendTime, tone, topic } = session;
    if (sendTime === 'now') {
      sendGmail(data.recipient, finalSubject, generatedEmail, attachments, tone, topic);
      bot.sendMessage(chatId, '✅ Email sent!');
    } else {
      const date = new Date(sendTime);
      if (isNaN(date.getTime())) {
        bot.sendMessage(chatId, '❌ Invalid time format. Please restart.');
        return;
      }
      schedule.scheduleJob(date, () => {
        sendGmail(data.recipient, finalSubject, generatedEmail, attachments, tone, topic);
      });
      bot.sendMessage(chatId, `📤 Email scheduled for ${date.toLocaleString()}`);
    }
    delete sessions[chatId];
  }

  if (data === 'discard') {
    delete sessions[chatId];
    bot.sendMessage(chatId, '🗑️ Email discarded.');
  }
});

// Main message flow
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const session = sessions[chatId];
  if (!session || msg.data) return;

  // Reminder mode
  if (session.mode === 'reminder') {
    if (session.step === 0) {
      session.data.text = text;
      session.step++;
      bot.sendMessage(chatId, '📧 Enter your email address:');
    } else if (session.step === 1) {
      session.data.email = text;
      session.step++;
      bot.sendMessage(chatId, '📅 When to remind? (YYYY-MM-DD HH:mm)');
    } else if (session.step === 2) {
      const when = new Date(text);
      if (isNaN(when.getTime())) {
        bot.sendMessage(chatId, '❌ Invalid date format.');
        return;
      }
      const { email, text: reminderText } = session.data;
      schedule.scheduleJob(when, () => {
        sendGmail(email, '🔔 Reminder!', reminderText);
      });
      bot.sendMessage(chatId, `✅ Reminder set for ${when.toLocaleString()}`);
      delete sessions[chatId];
    }
    return;
  }

  // Handle attachments
  if (session.awaitingAttachments) {
    if (msg.document || msg.photo) {
      const fileId = msg.document?.file_id || msg.photo?.at(-1)?.file_id;
      const file = await bot.getFile(fileId);
      const filename = msg.document?.file_name || `img_${Date.now()}.jpg`;
      const filePath = path.join(ensureTempDir(), filename);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;

      try {
        const response = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        await new Promise((res, rej) => {
          writer.on('finish', res);
          writer.on('error', rej);
        });
        session.attachments.push(filePath);
        await bot.sendMessage(chatId, `✅ Saved: ${filename}`);
      } catch (err) {
        console.error('File save error:', err);
        bot.sendMessage(chatId, '❌ Failed to save file.');
      }
    }
    return;
  }

  // Email generation flow
  switch (session.step) {
    case 0:
      session.data.role = text;
      session.step = 1;
      bot.sendMessage(chatId, '👤 Please enter your full name:');
      break;

    case 1:
      session.data.name = text;
      session.step = 2;
      bot.sendMessage(chatId, '✉️ Choose tone:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Formal', callback_data: 'Formal' }],
            [{ text: 'Casual', callback_data: 'Casual' }]
          ]
        }
      });
      break;

    case 3:
      session.data.topic = text;
      session.step++;
      bot.sendMessage(chatId, '📌 Enter subject (or type `auto`):');
      break;

    case 4:
      session.data.subject = text;
      session.step++;
      bot.sendMessage(chatId, '📬 Enter recipient\'s email address:');
      break;

    case 5:
      session.data.recipient = text;
      session.step++;
      bot.sendMessage(chatId, '📎 Upload attachments (optional). Tap *Done* when finished.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✅ Done Uploading', callback_data: 'done_upload' }]]
        }
      });
      session.awaitingAttachments = true;
      break;

    case 7:
      session.sendTime = text.toLowerCase();
      const finalSubject = session.data.subject === 'auto' || !session.data.subject
        ? recommendSubject(session.data.topic, session.data.tone)
        : session.data.subject;

      bot.sendChatAction(chatId, 'typing');
      bot.sendMessage(chatId, '✍️ Generating email, please wait...');

      try {
        let rawEmail = await generateEmail({ ...session.data, subject: finalSubject });

        // Insert greeting and signature
        const recipientName = session.data.recipient.split('@')[0];
        const greeting = `Dear ${recipientName.charAt(0).toUpperCase() + recipientName.slice(1)},\n`;
        const signature = `\n\nSincerely,\n${session.data.name}\n${session.data.role}`;

        rawEmail = `${greeting}\n${rawEmail}${signature}`;

        session.generatedEmail = rawEmail;
        session.finalSubject = finalSubject;

        const preview = `📝 *Email Preview:*\n\n*Subject:* ${finalSubject}\n*To:* ${session.data.recipient}\n\n${rawEmail}`;
        await bot.sendMessage(chatId, preview, { parse_mode: 'Markdown' });

        bot.sendMessage(chatId, '✅ Confirm sending email?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📤 Send Now', callback_data: 'confirm_send_now' }],
              [{ text: '❌ Discard', callback_data: 'discard' }]
            ]
          }
        });
      } catch (err) {
        console.error('Email generation error:', err);
        bot.sendMessage(chatId, '❌ Failed to generate email. Try again.');
      }
      break;
  }
});

// 🌐 Render keep-alive endpoint
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('🤖 Telegram Email Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
