require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./models/User");
const Rules = require("./models/Rules");
const scheduleJob = require("node-schedule");

const token = process.env.BOT_TOKEN;
const mongoUri = process.env.MONGO_URI;
const api = process.env.API_KEY;

const bot = new TelegramBot(token, { polling: true });

mongoose
  .connect("mongodb://localhost:27017/telegramBotDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    initializeRules();
  })
  .catch((error) => {
    console.error("Couldn't connect to MongoDB");
  });

async function initializeRules() {
  const existingRules = await Rules.findOne();
  if (!existingRules) {
    await Rules.create({
      offensiveWords: ["spam", "scam", "fake"],
      spamLimit: 5,
    });
    console.log("Default rules created");
  }
}

bot.on("message", async (msg) => {
  if (msg.new_chat_member) {
    bot.deleteMessage(msg.chat.id, msg.message_id);
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({
      userId,
      firstName: msg.from.first_name,
    });
  }

  const rules = await Rules.findOne();

  const now = Date.now();
  user.spamActivity = user.spamActivity.filter(
    (timestamp) => now - timestamp <= 10000
  );

  if (user.spamActivity.length > rules.spamLimit) {
    bot.sendMessage(
      chatId,
      `${msg.from.first_name}, KINDLY STOP SPAMMING PLEASE!`
    );
    user.spamActivity = []; //this line will reset activity after warning
  }

  if (
    rules.offensiveWords.some((word) => msg.text && msg.text.includes(word))
  ) {
    user.warning += 1;
    bot.sendMessage(
      chatId,
      `${msg.from.first_name}, WARNING! Total warnings: ${user.warning}`
    );

    if (user.warning >= 3) {
      bot.kickChatMmeber(chatId, userId).then(() => {
        bot.sendMessage(
          chatId,
          `${msg.from.first_name} has been removed for repeated violations.`
        );
      });
    }
  }
  await user.save();
});

bot.onText(/\update (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const adminId = msg.from.id;
  const updateText = match[1];

  const admins = await bot.getChatAdministrators(chatId);
  const isAdmin = admins.some((admin) => admins.user.id === adminId);

  if (isAdmin) {
    bot.sendMessage(chatId, `🔊Update:\n/n${updateText}`);
  } else {
    bot.sendMessage(chatId, "❌ You dont't have permission to send updates.");
  }
});

scheduleJob.scheduleJob("1 2 * * *", () => {
  console.log("Scheduled job is running!");
  const groupId = "https://t.me/DARN_Discussion_Space";
  bot.sendMessage(
    groupId,
    `🔊 🛡 How to protect your Telegram account? 🛡\n\n

    Use the tips below to ensure maximum privacy & protection from hacking ⬇\n\n

    ⿡ Set additional passwords\n
    ⚙ Settings ➜ Privacy and Security\n
    a) Two-Step Verification ➜ Set Password\n
    b) Passcode Lock ➜ Enable Passcode\n\n

    ⿢ Take care of privacy\n
    ⚙ Settings ➜ Privacy and Security\n 
    a) Phone Number ➜ Nobody/My Contacts\n
    b) Forwarded Messages ➜ Nobody\n
    c) Calls ➜ Nobody/My Contacts\n
    d) Groups ➜ My Contacts\n\n

    #SafetyRules`
  );
});

bot.onText(/\news (.+)/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await axios.get("https://newsapi.org/v2/top-headlines", {
      params: {
        country: "us",
        apiKey: api,
      },
    });
    const articles = response.data.articles.slice(0, 3);
    let newsMessage = `📰 **Today's Top News:**\n\n`;

    articles.forEach((article, index) => {
      newsMessage += `${index + 1}. [${article.title}] (${article.url})\n`;
    });
    bot.sendMessage(chatId, newsMessage, { parse_mode: "Markdown" });
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "❌ Failed to fetch news updates.");
  }
});
