const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');

const MODER_ROLES = [
  '1484266536188514396','1484266955635556483','1486807581388181626','1487138476133449870','1496571465376596089'
];
const MAIN_PING_ROLE = '1496571465376596089';
const CATEGORY_ID = '1496574445597360220';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('qualtest-manhunt')
    .setDescription('Квалификационный тест (Manhunt)'),

  async execute(interaction) {
    const allowedRoles = ['1481040977102897366', '1401145264571682886'];
    const hasPermission = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))
                       || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!hasPermission) return interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });

    await interaction.reply({ content: '⏳ Отправляю панель...', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('◈ Квалификационный тест — Manhunt')
      .setDescription('Нажмите кнопку ниже, чтобы пройти квалификационный тест.\n\n⏳ КД на тест — **7 дней**.\n⚠️ Предоставление недостоверной информации приведет к отказу.')
      .setFooter({ text: 'Система квалификации Manhunt' })
      .setTimestamp()
      .setColor(0xa0522d);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_qualtest_manhunt').setLabel('Пройти тест Manhunt').setStyle(ButtonStyle.Primary).setEmoji('📋'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ Панель квалификации Manhunt отправлена!' });
  },

  async handleButton(interaction) {
    if (interaction.customId === 'btn_qualtest_manhunt') {
      const modal = new ModalBuilder().setCustomId('qualtest_manhunt_modal').setTitle('Квалификационный тест Manhunt');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм').setPlaceholder('Введите ваш ник в игре').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server').setLabel('Сервер').setPlaceholder('Например: worst-practice.ru').setStyle(TextInputStyle.Short).setRequired(true)),
      );
      await interaction.showModal(modal);
      return true;
    }
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'qualtest_manhunt_modal') return;
    const guild = interaction.guild;
    const user = interaction.user;
    const nickname = interaction.fields.getTextInputValue('nickname');
    const server = interaction.fields.getTextInputValue('server');

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];
    MODER_ROLES.forEach(roleId => {
      if (guild.roles.cache.has(roleId))
        permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    });

    const ticketChannel = await guild.channels.create({
      name: `manhunt-тест-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites,
      parent: CATEGORY_ID,
    });

    const embed = new EmbedBuilder()
      .setTitle('📋 Заявка на квалификационный тест Manhunt')
      .addFields(
        { name: 'Никнейм', value: nickname, inline: true },
        { name: 'Сервер', value: server, inline: true },
        { name: 'Пользователь', value: `${user} (${user.tag})`, inline: false },
      )
      .setColor(0xa0522d)
      .setTimestamp()
      .setFooter({ text: `ID пользователя: ${user.id}` });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Закрыть тикет').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    );

    await ticketChannel.send({ content: `<@&${MAIN_PING_ROLE}> | Новая заявка на тест Manhunt от ${user}`, embeds: [embed], components: [closeRow] });
    await interaction.reply({ content: `✅ Заявка на Manhunt отправлена! Канал: ${ticketChannel}`, ephemeral: true });
  },
};
