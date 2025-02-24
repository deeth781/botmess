const fs = require("fs");

module.exports.config = {
    name: "tucam",
    version: "1.2.3",
    hasPermssion: 1,
    credits: "Staw",
    description: "Quản lý từ cấm và tự động xử lý vi phạm",
    commandCategory: "Quản lý nhóm",
    usages: "[add | del | list | status]",
    cooldowns: 5,
};

const dataDir = "./data5/boxData";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const configPath = "./config.json";
let botAdmins = [];
if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath));
    botAdmins = config.botAdmins || [];
}

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID } = event;
    const filePath = `${dataDir}/${threadID}.json`;
    let data = { bannedWords: [], warnings: {}, enabled: true };
    if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath));
    }

    switch (args[0]) {
        case "add": {
            const word = args.slice(1).join(" ");
            if (!word) return api.sendMessage("⚠️ Hãy nhập từ cần cấm!", threadID, messageID);
            if (data.bannedWords.includes(word)) return api.sendMessage("⚠️ Từ này đã có trong danh sách cấm!", threadID, messageID);
            data.bannedWords.push(word);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
            return api.sendMessage(`✅ Đã thêm từ cấm: ${word}`, threadID, messageID);
        }
        case "del": {
            const word = args.slice(1).join(" ");
            if (!word) return api.sendMessage("⚠️ Hãy nhập từ cần xóa!", threadID, messageID);
            if (!data.bannedWords.includes(word)) return api.sendMessage("⚠️ Từ này không có trong danh sách cấm!", threadID, messageID);
            data.bannedWords = data.bannedWords.filter(w => w !== word);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
            return api.sendMessage(`✅ Đã xóa từ cấm: ${word}`, threadID, messageID);
        }
        case "list": {
            return api.sendMessage(`📜 Danh sách từ cấm: ${data.bannedWords.length > 0 ? data.bannedWords.join(", ") : "Không có từ nào."}`, threadID, messageID);
        }
        case "status": {
            data.enabled = !data.enabled;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
            return api.sendMessage(`🔄 Tính năng kiểm tra từ cấm hiện đang: ${data.enabled ? "BẬT" : "TẮT"}`, threadID, messageID);
        }
        default:
            return api.sendMessage("⚠️ Lệnh không hợp lệ! Sử dụng: add, del, list, status", threadID, messageID);
    }
};

module.exports.handleEvent = async function({ api, event }) {
    const { threadID, senderID, body, messageID } = event;
    if (!body) return;

    const filePath = `${dataDir}/${threadID}.json`;
    if (!fs.existsSync(filePath)) return;

    const data = JSON.parse(fs.readFileSync(filePath));
    if (!data.enabled) return;

    const prefix = "!tucam";
    if (body.startsWith(prefix)) return;

    api.getThreadInfo(threadID, async (err, info) => {
        if (err) return;
        const admins = info.adminIDs.map(e => e.id);
        if (admins.includes(senderID) || botAdmins.includes(senderID)) return; // Không cảnh báo hoặc kick quản trị viên hoặc admin bot

        if (data.bannedWords.some(word => body.toLowerCase().includes(word.toLowerCase()))) {
            if (!data.warnings[senderID]) data.warnings[senderID] = 0;
            data.warnings[senderID]++;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));

            api.getUserInfo(senderID, async (err, info) => {
                if (err) return;
                const userName = info[senderID]?.name || "Người dùng";
                api.unsendMessage(messageID);

                if (data.warnings[senderID] >= 3) {
                    api.removeUserFromGroup(senderID, threadID, (err) => {
                        if (!err) {
                            delete data.warnings[senderID];
                            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
                            api.sendMessage(`🚫 Thành viên ${userName} đã bị kick do vi phạm từ cấm quá 3 lần!`, threadID);
                        } else {
                            api.sendMessage("⚠️ Bot cần quyền quản trị viên để kick thành viên!", threadID);
                        }
                    });
                } else {
                    api.sendMessage(`⚠️ ${userName}, bạn đã dùng từ cấm! (Lần ${data.warnings[senderID]}/3)`, threadID);
                }
            });
        }
    });
};
