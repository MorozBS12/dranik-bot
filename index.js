require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./src/database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
  initDB();
});

const BUTTON_COMMAND_MAP = {
  'btn_moderator':          'staff',
  'btn_tester':             'staff',
  'btn_qualtest':           'qualtest',
  'btn_qualtest_muhc':      'qualtest-muhc',
  'btn_qualtest_speed':     'qualtest-speed',
  'btn_qualtest_mace':      'qualtest-mace',
  'btn_qualtest_creeper':   'qualtest-creeper',
  'btn_qualtest_diacart':   'qualtest-diacart',
  'btn_qualtest_dsmp':      'qualtest-dsmp',
  'btn_qualtest_bed':       'qualtest-bed',
  'btn_qualtest_iuhc':      'qualtest-iuhc',
  'btn_qualtest_nethpot':   'qualtest-nethpot',
  'btn_qualtest_manhunt':   'qualtest-manhunt',
  'btn_support':            'support',
  'btn_complaint':          'support',
};

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); }
    catch (err) { console.error(err); }
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
      try { await command.handleButton(interaction); }
      catch (err) { console.error(err); }
    }
  }

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    let commandName;
    if      (customId.startsWith('qualtest_muhc'))     commandName = 'qualtest-muhc';
    else if (customId.startsWith('qualtest_speed'))    commandName = 'qualtest-speed';
    else if (customId.startsWith('qualtest_mace'))     commandName = 'qualtest-mace';
    else if (customId.startsWith('qualtest_creeper'))  commandName = 'qualtest-creeper';
    else if (customId.startsWith('qualtest_diacart'))  commandName = 'qualtest-diacart';
    else if (customId.startsWith('qualtest_dsmp'))     commandName = 'qualtest-dsmp';
    else if (customId.startsWith('qualtest_bed'))      commandName = 'qualtest-bed';
    else if (customId.startsWith('qualtest_iuhc'))     commandName = 'qualtest-iuhc';
    else if (customId.startsWith('qualtest_nethpot'))  commandName = 'qualtest-nethpot';
    else if (customId.startsWith('qualtest_manhunt'))  commandName = 'qualtest-manhunt';
    else if (customId.startsWith('result-muhc'))       commandName = 'result-muhc';
    else if (customId.startsWith('result-speed'))      commandName = 'result-speed';
    else if (customId.startsWith('result-mace'))       commandName = 'result-mace';
    else if (customId.startsWith('result-creeper'))    commandName = 'result-creeper';
    else if (customId.startsWith('result-diacart'))    commandName = 'result-diacart';
    else if (customId.startsWith('result-dsmp'))       commandName = 'result-dsmp';
    else if (customId.startsWith('result-bed'))        commandName = 'result-bed';
    else if (customId.startsWith('result-iuhc'))       commandName = 'result-iuhc';
    else if (customId.startsWith('result-nethpot'))    commandName = 'result-nethpot';
    else if (customId.startsWith('result-manhunt'))    commandName = 'result-manhunt';
    else commandName = customId.split('_')[0];

    const handler = client.commands.get(commandName);
    if (handler?.handleModal) {
      try { await handler.handleModal(interaction); }
      catch (err) { console.error(err); }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
