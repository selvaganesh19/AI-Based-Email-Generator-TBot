require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const { sendGmail, recommendSubject } = require('../gmail');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const sessions = {};

const ensureTempDir = () => {
  const dir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return dir;
};

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { mode: 'email', step: 0, data: {}, attachments: [] };
  bot.sendMessage(chatId, '👋 What is your role (e.g., Developer, Student)?');
});

// /remindme command
bot.onText(/\/remindme/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { mode: 'reminder', step: 0, data: {} };
  bot.sendMessage(chatId, '🔔 What should I remind you about?');
});

// Handle inline "Done" callback for attachments
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const session = sessions[chatId];
  const data = query.data;

  if (!session) return;

  if (data === 'done_upload') {
    session.awaitingAttachments = false;
    session.step++;
    bot.sendMessage(chatId, '📅 When should I send the email? Type `now` or a time like `2025-07-01 12:00`');
  }

  if (data === 'Formal' || data === 'Casual') {
    session.data.tone = data;
    session.step = 2;
    bot.sendMessage(chatId, `📝 What is the topic of the email? (Tone: ${data})`);
  }
});

// Handle file uploads (images, PDFs, DOCX, PPT)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const session = sessions[chatId];

  if (!session || msg.text?.startsWith('/')) return;

  // ✅ Reminder flow
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

  // ✅ Uploading attachments
  if (session.awaitingAttachments) {
    if (msg.document || msg.photo) {
      const fileId = msg.document?.file_id || msg.photo?.at(-1)?.file_id;
      const file = await bot.getFile(fileId);
      const filename = msg.document?.file_name || `img_${Date.now()}.jpg`;
      const filePath = path.join(ensureTempDir(), filename);

      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
      const response = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      writer.on('finish', () => {
        session.attachments.push(filePath);
        bot.sendMessage(chatId, `✅ Saved: ${filename}`);
      });

      return;
    }

    return; // block other messages while uploading
  }

  // ✅ Email writing flow
  switch (session.step) {
    case 0:
      session.data.role = text;
      session.step++;
      bot.sendMessage(chatId, '✉️ Choose tone:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Formal', callback_data: 'Formal' }],
            [{ text: 'Casual', callback_data: 'Casual' }]
          ]
        }
      });
      break;

    case 2:
      session.data.topic = text;
      session.step++;
      bot.sendMessage(chatId, '📌 Enter subject (leave blank to auto-generate):');
      break;

    case 3:
      session.data.subject = text;
      session.step++;
      bot.sendMessage(chatId, '📬 Enter recipient\'s email address:');
      break;

    case 4:
      session.data.recipient = text;
      session.step++;
      bot.sendMessage(chatId, '📎 You can now upload images, PDFs, or other files. Tap *Done* when finished.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✅ Done Uploading', callback_data: 'done_upload' }]]
        }
      });
      session.awaitingAttachments = true;
      break;

    case 6:
      const sendTime = text.toLowerCase();
      const finalSubject = session.data.subject || recommendSubject(session.data.topic, session.data.tone);
      const emailText = await generateEmail({ ...session.data, subject: finalSubject });

      const preview = `📝 *Email Preview:*\n\n*Subject:* ${finalSubject}\n*To:* ${session.data.recipient}\n\n${emailText}`;
      await bot.sendMessage(chatId, preview, { parse_mode: 'Markdown' });

      bot.sendMessage(chatId, '✅ Confirm sending email?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Send Now', callback_data: 'confirm_send_now' }],
            [{ text: '❌ Discard', callback_data: 'discard' }]
          ]
        }
      });

      session.sendTime = sendTime;
      session.generatedEmail = emailText;
      session.finalSubject = finalSubject;
      break;
  }
});

// Confirm sending email or discard
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const session = sessions[chatId];
  if (!session) return;

  const data = query.data;

  if (data === 'confirm_send_now') {
    if (session.sendTime === 'now') {
      sendGmail(session.data.recipient, session.finalSubject, session.generatedEmail, session.attachments, session.data.tone, session.data.topic);
      bot.sendMessage(chatId, '✅ Email sent!');
    } else {
      const date = new Date(session.sendTime);
      if (isNaN(date.getTime())) {
        bot.sendMessage(chatId, '❌ Invalid time format. Please restart.');
        return;
      }
      schedule.scheduleJob(date, () => {
        sendGmail(session.data.recipient, session.finalSubject, session.generatedEmail, session.attachments, session.data.tone, session.data.topic);
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

// Email generator using Cohere
async function generateEmail({ role, tone, topic, subject }) {
  const prompt = `Write a ${tone} email from a ${role} about: ${topic}. Subject: "${subject}".`;
  const response = await axios.post('https://api.cohere.ai/v1/generate', {
    model: 'command',
    prompt,
    max_tokens: 300,
    temperature: 0.7
  }, {
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.generations[0].text.trim();
}
