import { createServer } from 'http';
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
bot.setWebHook(`${process.env.VERCEL_URL}/api/webhook`);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    await bot.processUpdate(req.body);
    res.status(200).send('ok');
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
