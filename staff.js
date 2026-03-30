const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');

// Список ролей, которые будут видеть тикет
const MODER_ROLES = [
  '1487138476133449870',
];

const CATEGORY_ID = '1487137128637927584';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Панель набора в стафф'),

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
      .setTitle('Набор в стафф')
      .setDescription('Подайте заявку на желаемую должность, нажав на кнопку ниже.')
      .setFooter({ text: 'Система заявок Staff' })
      .setTimestamp()
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_moderator')
        .setLabel('Стать модератором')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('btn_tester')
        .setLabel('Стать тестером')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎮'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ Панель набора отправлена!' });
  },

  async handleButton(interaction) {
    if (interaction.customId === 'btn_moderator') {
      const modal = new ModalBuilder()
        .setCustomId('staff_modal_moderator')
        .setTitle('Заявка на модератора');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм').setPlaceholder('Ваш ник в игре').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('age').setLabel('Ваш возраст').setPlaceholder('Пример: 16').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('experience').setLabel('Есть опыт?').setPlaceholder('Где работали раньше?').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('why').setLabel('Почему именно вы?').setPlaceholder('Расскажите о себе').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === 'btn_tester') {
      const modal = new ModalBuilder()
        .setCustomId('staff_modal_tester')
        .setTitle('Заявка на тестера');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм').setPlaceholder('Ваш ник в игре').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('age').setLabel('Ваш возраст').setPlaceholder('Пример: 16').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('tier').setLabel('Ваш тир').setPlaceholder('Пример: HT3').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('experience').setLabel('Есть опыт?').setPlaceholder('Где тестировали раньше?').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('why').setLabel('Почему именно вы?').setPlaceholder('Ваши сильные стороны').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
      );
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId === 'btn_close_ticket') {
      await interaction.reply({ content: '🔒 Заявка будет удалена через 5 секунд...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return true;
    }
  },

  async handleModal(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;

    const createTicket = async (type, fields) => {
     const permissionOverwrites = [
  { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
  { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
];

MODER_ROLES.forEach(roleId => {
  if (guild.roles.cache.has(roleId)) {
    permissionOverwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }
});

      const ticketChannel = await guild.channels.create({
        name: `заявка-${type}-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites,
        parent: CATEGORY_ID,
      });

      const embed = new EmbedBuilder()
        .setTitle(`📋 Новая заявка: ${type}`)
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({ text: `ID пользователя: ${user.id}` });

      for (const [name, value] of Object.entries(fields)) {
        embed.addFields({ name, value: value || 'Не указано' });
      }
      embed.addFields({ name: 'Кандидат', value: `${user} (${user.tag})` });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_close_ticket')
          .setLabel('Закрыть тикет')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
      );

      // ИСПРАВЛЕНО: Убрано упоминание роли, оставлен только текст
      await ticketChannel.send({ 
        content: `Новая заявка от ${user}`, 
        embeds: [embed], 
        components: [closeRow] 
      });

      return ticketChannel;
    };

    try {
        if (interaction.customId === 'staff_modal_moderator') {
          const fields = {
            'Никнейм': interaction.fields.getTextInputValue('nickname'),
            'Возраст': interaction.fields.getTextInputValue('age'),
            'Опыт': interaction.fields.getTextInputValue('experience'),
            'Почему хочет': interaction.fields.getTextInputValue('why'),
          };
          const ticket = await createTicket('модератор', fields);
          await interaction.reply({ content: `✅ Ваша заявка отправлена! Канал: ${ticket}`, ephemeral: true });
        } else if (interaction.customId === 'staff_modal_tester') {
          const fields = {
            'Никнейм': interaction.fields.getTextInputValue('nickname'),
            'Возраст': interaction.fields.getTextInputValue('age'),
            'Тир': interaction.fields.getTextInputValue('tier'),
            'Опыт': interaction.fields.getTextInputValue('experience'),
            'Почему хочет': interaction.fields.getTextInputValue('why'),
          };
          const ticket = await createTicket('тестер', fields);
          await interaction.reply({ content: `✅ Ваша заявка отправлена! Канал: ${ticket}`, ephemeral: true });
        }
    } catch (e) {
        console.error(e);
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ Произошла ошибка при создании тикета.', ephemeral: true });
        }
    }
  },
};