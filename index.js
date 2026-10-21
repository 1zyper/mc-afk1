const mineflayer = require('mineflayer');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onValue, set, push } = require('firebase/database');
const http = require('http');

// Render'ın kapanmaması için gerekli port dinleme sunucusu
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Minecraft Bot aktif ve çalışıyor!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP sunucusu ${PORT} portunda çalışıyor.`);
});

// Firebase Bağlantısı[cite: 2]
const firebaseConfig = {
    databaseURL: "https://dsfdsfsfds-e39e9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let bot = null;

function sendLog(msg) {
    console.log(msg);
    try {
        push(ref(db, 'bot/logs'), { text: msg, time: Date.now() });
    } catch(e) {}
}

// Konfigürasyon Dinleyicisi
onValue(ref(db, 'bot/config'), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.action === 'connect' && !bot) {
        startBot(data.ip, Number(data.port), data.username);
    } else if (data.action === 'disconnect' && bot) {
        sendLog("Bot bağlantısı kesiliyor...");
        bot.quit();
        bot = null;
        set(ref(db, 'bot/config/status'), 'offline');
    }
});

// Hareket Kontrolleri
onValue(ref(db, 'bot/controls'), (snapshot) => {
    const controls = snapshot.val();
    if (!controls || !bot) return;

    if (bot.setControlState) {
        bot.setControlState('forward', controls.forward || false);
        bot.setControlState('back', controls.backward || false);
        bot.setControlState('left', controls.left || false);
        bot.setControlState('right', controls.right || false);
        bot.setControlState('jump', controls.jump || false);
    }
});

// Sohbet Komutu
onValue(ref(db, 'bot/chatCommand'), (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && bot && cmd.text) {
        bot.chat(cmd.text);
        set(ref(db, 'bot/chatCommand'), null);
    }
});

function startBot(ip, port, username) {
    sendLog(`Bot başlatılıyor... IP: ${ip}:${port}, İsim: ${username}`);
    try {
        bot = mineflayer.createBot({
            host: ip,
            port: port,
            username: username,
            version: '1.21.1' // 1.21.11 sürümleriyle uyumlu
        });

        bot.on('spawn', () => {
            sendLog('Bot oyuna başarıyla girdi!');
            set(ref(db, 'bot/config/status'), 'online');
        });

        bot.on('chat', (username, message) => {
            sendLog(`[Chat] ${username}: ${message}`);
        });

        bot.on('end', (reason) => {
            sendLog(`Bot oyundan düştü: ${reason}`);
            bot = null;
            set(ref(db, 'bot/config/status'), 'offline');
            set(ref(db, 'bot/config/action'), 'disconnected');
        });

        bot.on('error', (err) => {
            sendLog(`Hata: ${err.message}`);
        });
    } catch (e) {
        sendLog(`Kritik hata: ${e.message}`);
        bot = null;
        set(ref(db, 'bot/config/status'), 'offline');
    }
}
