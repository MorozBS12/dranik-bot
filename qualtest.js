const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');

const MODER_ROLES = [
  '1484266536188514396', 
  '1484266955635556483',
  '1486839414893052138',
  '1480616685999226971',
  '1487138476133449870'
];

const MAIN_PING_ROLE = '1486839414893052138';
const CATEGORY_ID = '1484641864299839578';


module.exports = {
  data: new SlashCommandBuilder()
    .setName('qualtest')
    .setDescription('Квалификационный тест'),

  async execute(interaction) {
    const allowedRoles = ['1481040977102897366', '1401145264571682886']; 
    
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)) 
                          || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return interaction.reply({ 
        content: '❌ У вас нет прав для вызова этой панели!', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('◈ Квалификационный тест')
      .setDescription(
        'Нажмите кнопку ниже, чтобы пройти квалификационный тест.\n\n' +
        '⏳ КД на тест — **7 дней**.\n' +
        '⚠️ Предоставление недостоверной информации приведет к отказу.'
      )
      .setFooter({ text: 'Система квалификации' })
      .setTimestamp()
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_qualtest')
        .setLabel('Пройти тест')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ Панель квалификации отправлена!' });
  },

  async handleButton(interaction) {
    if (interaction.customId === 'btn_qualtest') {
      const modal = new ModalBuilder()
        .setCustomId('qualtest_modal')
        .setTitle('Квалификационный тест');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nickname')
            .setLabel('Никнейм')
            .setPlaceholder('Введите ваш ник в игре')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('server')
            .setLabel('Сервер')
            .setPlaceholder('Например: worst-practice.ru')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
      );

      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === 'btn_close_ticket') {
      await interaction.reply({ content: '🔒 Тикет будет удален через 5 секунд...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return true;
    }
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'qualtest_modal') return;

    const guild = interaction.guild;
    const user = interaction.user;
    const nickname = interaction.fields.getTextInputValue('nickname');
    const server = interaction.fields.getTextInputValue('server');

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];

    // Добавляем только роли которые существуют на сервере
    MODER_ROLES.forEach(roleId => {
      if (guild.roles.cache.has(roleId)) {
        permissionOverwrites.push({
          id: roleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }
    });

    const ticketChannel = await guild.channels.create({
      name: `тест-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites,
      parent: CATEGORY_ID,
    });

    const embed = new EmbedBuilder()
      .setTitle('📋 Заявка на квалификационный тест')
      .addFields(
        { name: 'Никнейм', value: nickname, inline: true },
        { name: 'Сервер', value: server, inline: true },
        { name: 'Пользователь', value: `${user} (${user.tag})`, inline: false },
      )
      .setColor(0x5865f2)
      .setTimestamp()
      .setFooter({ text: `ID пользователя: ${user.id}` });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_close_ticket')
        .setLabel('Закрыть тикет')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
    );

    await ticketChannel.send({ 
      content: `<@&${MAIN_PING_ROLE}> | Поступила новая заявка на тест от ${user}`, 
      embeds: [embed], 
      components: [closeRow] 
    });

    await interaction.reply({
      content: `✅ Ваша заявка отправлена! Канал теста: ${ticketChannel}`,
      ephemeral: true,
    });
  },
};
