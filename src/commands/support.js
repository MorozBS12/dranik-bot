const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');

// Список ID ролей модераторов, которые будут видеть тикеты
const MODER_ROLES = [
  '1484266955635556483',
  '1486844213994717266',
  '1487138476133449870',
]; 

const CATEGORY_ID = '1487142057599434914';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Центр поддержки'),

  async execute(interaction) {
    // Проверка прав на отправку панели (Администратор или спец. роли)
    const allowedRoles = ['1481040977102897366', '1401145264571682886']; 
    
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)) 
                          || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return interaction.reply({ 
        content: '❌ У вас нет прав для использования этой команды!', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('Центр поддержки')
      .setDescription('Выберите тему обращения, нажав соответствующую кнопку ниже.')
      .setFooter({ text: 'Система поддержки' })
      .setTimestamp()
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_support')
        .setLabel('Поддержка')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId('btn_complaint')
        .setLabel('Жалоба')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ Панель поддержки отправлена!' });
  },

  async handleButton(interaction) {
    if (interaction.customId === 'btn_support') {
      const modal = new ModalBuilder()
        .setCustomId('support_modal_support')
        .setTitle('Обращение в поддержку');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nickname').setLabel('Никнейм')
            .setPlaceholder('Введите ваш игровой никнейм')
            .setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('problem').setLabel('Опишите проблему')
            .setPlaceholder('Максимально подробно расскажите о вашей ситуации')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === 'btn_complaint') {
      const modal = new ModalBuilder()
        .setCustomId('support_modal_complaint')
        .setTitle('Подача жалобы');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nickname').setLabel('Ваш никнейм')
            .setPlaceholder('Ваш ник в игре')
            .setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('target').setLabel('На кого жалоба')
            .setPlaceholder('Никнейм нарушителя')
            .setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason').setLabel('Причина жалобы')
            .setPlaceholder('Что именно произошло?')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('proof').setLabel('Доказательства')
            .setPlaceholder('Ссылки на скриншоты или видео')
            .setStyle(TextInputStyle.Paragraph).setRequired(false)
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
    const guild = interaction.guild;
    const user = interaction.user;

    const createTicket = async (type, fields) => {
      const permissionOverwrites = [
        { 
          id: guild.id, 
          deny: [PermissionFlagsBits.ViewChannel] 
        },
        { 
          id: user.id, 
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
        },
      ];

      // Добавляем доступ каждой роли модератора (без пинга)
     MODER_ROLES.forEach(roleId => {
  if (guild.roles.cache.has(roleId)) {
    permissionOverwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }
});

      const ticketChannel = await guild.channels.create({
        name: `${type === 'support' ? 'помощь' : 'жалоба'}-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites,
        parent: CATEGORY_ID,
      });

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${type === 'support' ? 'Новое обращение' : 'Новая жалоба'}`)
        .setColor(type === 'support' ? 0x57f287 : 0xed4245)
        .setTimestamp()
        .setFooter({ text: `ID пользователя: ${user.id}` });

      for (const [name, value] of Object.entries(fields)) {
        embed.addFields({ name, value: value || 'не указано' });
      }
      
      embed.addFields({ name: 'Отправитель', value: `${user} (${user.tag})` });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_close_ticket')
          .setLabel('Закрыть тикет')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
      );

      // ВИПРАВЛЕНО: Убраны пинги ролей. Теперь только упоминание пользователя-создателя.
      await ticketChannel.send({ 
        content: `Тикет открыт пользователем ${user}`, 
        embeds: [embed], 
        components: [closeRow] 
      });
      
      return ticketChannel;
    };

    if (interaction.customId === 'support_modal_support') {
      const fields = {
        'Никнейм': interaction.fields.getTextInputValue('nickname'),
        'Проблема': interaction.fields.getTextInputValue('problem'),
      };
      const ticket = await createTicket('support', fields);
      await interaction.reply({ content: `✅ Обращение отправлено! Ваш тикет: ${ticket}`, ephemeral: true });
    }

    if (interaction.customId === 'support_modal_complaint') {
      const fields = {
        'Никнейм': interaction.fields.getTextInputValue('nickname'),
        'На кого жалоба': interaction.fields.getTextInputValue('target'),
        'Причина': interaction.fields.getTextInputValue('reason'),
        'Доказательства': interaction.fields.getTextInputValue('proof') || 'не указано',
      };
      const ticket = await createTicket('complaint', fields);
      await interaction.reply({ content: `✅ Жалоба отправлена! Ваш тикет: ${ticket}`, ephemeral: true });
    }
  },
};