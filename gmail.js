// gmail.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';

function authorize(credentials, callback, emailDetails) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  let token;
  if (process.env.GOOGLE_TOKEN_BASE64) {
    const decoded = Buffer.from(process.env.GOOGLE_TOKEN_BASE64, 'base64').toString('utf-8');
    token = decoded;
  } else if (fs.existsSync(TOKEN_PATH)) {
    token = fs.readFileSync(TOKEN_PATH);
  } else {
    return getNewToken(oAuth2Client, callback, emailDetails); // only for local
  }

  oAuth2Client.setCredentials(JSON.parse(token));
  callback(oAuth2Client, emailDetails);
}

function getNewToken(oAuth2Client, callback, emailDetails) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('\n🔐 Authorize this app by visiting this URL:\n', authUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\nPaste the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('❌ Token Error', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('✅ Token stored to', TOKEN_PATH);
      callback(oAuth2Client, emailDetails);
    });
  });
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.jpeg':
    case '.jpg': return 'image/jpeg';
    case '.pdf': return 'application/pdf';
    case '.doc':
    case '.docx': return 'application/msword';
    case '.ppt':
    case '.pptx': return 'application/vnd.ms-powerpoint';
    default: return 'application/octet-stream';
  }
}

function recommendSubject(topic, tone) {
  const suggestions = {
    Formal: `Regarding: ${topic}`,
    Casual: `Let's talk about ${topic}`,
  };
  return suggestions[tone] || `Subject: ${topic}`;
}

function sendGmail(recipient, subject, body, attachments = [], tone = 'Formal', topic = '') {
  if (!subject || subject.trim() === '') {
    subject = recommendSubject(topic, tone);
    console.log(`ℹ️ Using recommended subject: ${subject}`);
  }

  const boundary = '__MY_BOUNDARY__';
  const messageParts = [
    `To: ${recipient}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"\n`,
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit\n',
    body,
  ];

  if (attachments.length > 0) {
    attachments.forEach((filePath) => {
      try {
        const fileData = fs.readFileSync(filePath).toString('base64');
        const filename = path.basename(filePath);
        const mimeType = getMimeType(filename);
        messageParts.push(
          `--${boundary}`,
          `Content-Type: ${mimeType}; name="${filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${filename}"\n`,
          fileData
        );
      } catch (err) {
        console.error(`⚠️ Error attaching file ${filePath}:`, err.message);
      }
    });
  }

  messageParts.push(`--${boundary}--`);
  const fullMessage = messageParts.join('\n');
  const encodedMessage = Buffer.from(fullMessage).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const credentials = JSON.parse(fs.readFileSync('credentials.json'));
  authorize(credentials, async (auth) => {
    const gmail = google.gmail({ version: 'v1', auth });
    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      console.log('📤 Email sent to:', recipient);
    } catch (err) {
      console.error('❌ Gmail API send error:', err);
    }
  }, fullMessage);
}

module.exports = { sendGmail, recommendSubject };
