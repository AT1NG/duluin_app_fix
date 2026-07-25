// bridge/firestore_waha_bridge.js
const fs = require('fs');
const path = require('path');


const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const admin = require('firebase-admin');
const http = require('http');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString())
  : require('./serviceAccountKey.json');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.log('⚠️ Warning: nodemailer tidak terinstal. Silakan jalankan: npm install nodemailer');
}

// Konfigurasi Email (Silakan ganti dengan detail Gmail Anda)
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'duluinapp@gmail.com',
    pass: 'oxyqlgtlcyncnisn'
  }
};

async function sendEmail(to, subject, text) {
  if (!nodemailer) {
    console.warn('⚠️ Nodemailer belum diinstal. Email tidak dapat dikirim.');
    return { success: false, skipped: true };
  }
  if (EMAIL_CONFIG.auth.user === 'GMAIL_ANDA@gmail.com' || EMAIL_CONFIG.auth.pass === 'KODE_SANDI_APLIKASI_GMAIL') {
    console.log(`⚠️ Konfigurasi email default terdeteksi. Silakan edit file bridge untuk mengatur sandi aplikasi Gmail Anda. Lewati kirim ke ${to}`);
    return { success: false, skipped: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: EMAIL_CONFIG.service,
      auth: EMAIL_CONFIG.auth
    });

    await transporter.sendMail({
      from: EMAIL_CONFIG.auth.user,
      to: to,
      subject: subject,
      text: text
    });
    console.log(`✉️ Email pengingat berhasil dikirim ke ${to}`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`❌ Gagal mengirim email ke ${to}:`, error);
    return { success: false, skipped: false };
  }
}


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const WAHA_URL = process.env.WAHA_URL || 'http://100.90.108.92:442/api/sendText';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';

const WAHA_SESSION = process.env.WAHA_SESSION || 'default';


const PHONE_TIMEZONE_OFFSET_MINUTES = 7 * 60; // WIB = UTC+7

console.log('🤖 ======================================================');
console.log('🤖 Duluin Firestore-to-WAHA Bridge Aktif...');
console.log('🤖 Menunggu tugas-tugas dari Firebase Cloud...');
console.log('🤖 ======================================================');

async function checkReminders() {
  try {
    const now = new Date();
    console.log(`[${now.toLocaleString()}] Memeriksa tugas di Firestore...`);

    const snapshot = await db.collection('tasks')
      .where('state', '!=', 'selesai')
      .get();

    for (const doc of snapshot.docs) {
      const task = doc.data();
      const taskId = doc.id;
      const name = task.name || '';
      const deadlineStr = task.deadline;
      const whatsappNumber = task.whatsapp_number || '';
      const email = task.email || '';
      const remind1d = task.remind_1d || false;
      const remind1h = task.remind_1h || false;
      const isWaSent1d = task.is_wa_sent_1d || false;
      const isWaSent1h = task.is_wa_sent_1h || false;
      const isEmailSent1d = task.is_email_sent_1d || false;
      const isEmailSent1h = task.is_email_sent_1h || false;

      if ((!whatsappNumber && !email) || (!remind1d && !remind1h)) continue;

      let deadline;
      try {
        const parts = deadlineStr.split(' ');
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        // Build the deadline as a genuine UTC instant from the WIB wall-clock
        // components, then shift back by the WIB offset. This is timezone-agnostic
        // (unlike `new Date(y,m,d,h,mi,s)`, which silently assumes the server's own
        // local timezone) so it gives the correct instant no matter what timezone
        // the bridge server itself runs in.
        deadline = new Date(Date.UTC(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2]),
          parseInt(timeParts[0]),
          parseInt(timeParts[1]),
          parseInt(timeParts[2] || '0')
        ) - PHONE_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
      } catch (e) {
        deadline = new Date(deadlineStr);
      }

      if (isNaN(deadline.getTime())) {
        console.error(`⚠️ Format tanggal salah untuk tugas "${name}": ${deadlineStr}`);
        continue;
      }


      const diffMs = deadline.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));


      if (diffMinutes > 60 && diffMinutes <= 1440) {
        if (remind1d && whatsappNumber && !isWaSent1d) {
          console.log(`⏰ Menyiapkan pengingat WA H-1 Hari untuk tugas "${name}" ke ${whatsappNumber}...`);
          const message = `🔔 *PENGINGAT H-1 HARI (Duluin)*\n\nHalo! Tugas/Agenda Anda:\n📌 *${name}*\n📅 Deadline: ${deadlineStr}\n\nJangan lupa dibereskan ya! 💪`;
          await sleep(Math.floor(Math.random() * 5000) + 3000);
          const success = await sendWhatsApp(whatsappNumber, message);
          if (success) {
            await db.collection('tasks').doc(taskId).update({ is_wa_sent_1d: true });
            console.log(`✅ Status pengingat WA H-1 Hari untuk "${name}" diperbarui di Firestore.`);
          }
        }

        if (remind1d && email && !isEmailSent1d) {
          console.log(`⏰ Menyiapkan pengingat Email H-1 Hari untuk tugas "${name}" ke ${email}...`);
          const subject = `🔔 Pengingat H-1 Hari: ${name}`;
          const text = `Halo!\n\nTugas/Agenda Anda:\n📌 Nama: ${name}\n📅 Deadline: ${deadlineStr}\n\nJangan lupa dibereskan ya! 💪\n\nSalam,\nTim Duluin App`;
          const result = await sendEmail(email, subject, text);
          if (result.success || result.skipped) {
            await db.collection('tasks').doc(taskId).update({ is_email_sent_1d: true });
            if (result.success) {
              console.log(`✅ Status pengingat Email H-1 Hari untuk "${name}" diperbarui di Firestore.`);
            }
          }
        }
      }


      if (diffMinutes > 0 && diffMinutes <= 60) {
        if (remind1h && whatsappNumber && !isWaSent1h) {
          console.log(`⏰ Menyiapkan pengingat WA H-1 Jam untuk tugas "${name}" ke ${whatsappNumber}...`);
          const message = `🚨 *PENGINGAT H-1 JAM (Duluin)*\n\nHalo! Waktu tugas Anda sisa 1 jam lagi:\n📌 *${name}*\n📅 Deadline: ${deadlineStr}\n\nAyo segera selesaikan! ⚡`;
          await sleep(Math.floor(Math.random() * 5000) + 3000);
          const success = await sendWhatsApp(whatsappNumber, message);
          if (success) {
            await db.collection('tasks').doc(taskId).update({ is_wa_sent_1h: true });
            console.log(`✅ Status pengingat WA H-1 Jam untuk "${name}" diperbarui di Firestore.`);
          }
        }

        if (remind1h && email && !isEmailSent1h) {
          console.log(`⏰ Menyiapkan pengingat Email H-1 Jam untuk tugas "${name}" ke ${email}...`);
          const subject = `🚨 Pengingat H-1 Jam: ${name}`;
          const text = `Halo!\n\nTugas/Agenda Anda:\n📌 Nama: ${name}\n📅 Deadline: ${deadlineStr}\n\nWaktu tersisa tinggal 1 jam lagi! Ayo segera selesaikan! ⚡\n\nSalam,\nTim Duluin App`;
          const result = await sendEmail(email, subject, text);
          if (result.success || result.skipped) {
            await db.collection('tasks').doc(taskId).update({ is_email_sent_1h: true });
            if (result.success) {
              console.log(`✅ Status pengingat Email H-1 Jam untuk "${name}" diperbarui di Firestore.`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error saat memeriksa pengingat:', error);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendWhatsApp(to, text) {
  return new Promise((resolve) => {
    let cleanTo = to.replace(/[^0-9]/g, '');
    if (cleanTo.startsWith('0')) {
      cleanTo = '62' + cleanTo.substring(1);
    }

    const payload = JSON.stringify({
      chatId: `${cleanTo}@c.us`,
      text: text,
      session: WAHA_SESSION
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (WAHA_API_KEY && WAHA_API_KEY.trim() !== '') {
      headers['X-Api-Key'] = WAHA_API_KEY.trim();
    }

    const url = new URL(WAHA_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✉️ Pesan WA berhasil dikirim ke ${cleanTo}`);
          resolve(true);
        } else {
          console.error(`❌ WAHA mengembalikan status error ${res.statusCode}:`, data);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Gagal terhubung ke WAHA PC (${WAHA_URL}):`, error.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

checkReminders();

const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
setTimeout(() => {
  checkReminders();
  setInterval(checkReminders, 60 * 1000);
}, msToNextMinute);
