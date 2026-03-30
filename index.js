require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./src/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    client.commands.set(command.data.name, command);
  }
}

client.once('ready', () => {
  console.log(`✅ Бот для Драника запущен как ${client.user.tag}`);
  initDB();
});

const BUTTON_COMMAND_MAP = {
  'btn_moderator':      'staff',
  'btn_tester':         'staff',
  'btn_qualtest':       'qualtest',
  'btn_qualtest_uhc':   'qualtest-uhc',
  'btn_qualtest_beast': 'qualtest-beast',
  'btn_support':        'support',
  'btn_complaint':      'support',
};

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'btn_close_ticket') {
      await interaction.reply({ content: '🔒 Тикет будет удален через 5 секунд...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    const commandName = BUTTON_COMMAND_MAP[interaction.customId];
    if (!commandName) return;
    const command = client.commands.get(commandName);
    if (command?.handleButton) {
      try {
        await command.handleButton(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    let commandName;

    if (customId.startsWith('qualtest_uhc')) commandName = 'qualtest-uhc';
    else if (customId.startsWith('qualtest_beast')) commandName = 'qualtest-beast';
    else if (customId.startsWith('result-uhc')) commandName = 'result-uhc';
    else if (customId.startsWith('result-beast')) commandName = 'result-beast';
    else commandName = customId.split('_')[0];

    const handler = client.commands.get(commandName);
    if (handler?.handleModal) {
      try {
        await handler.handleModal(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
