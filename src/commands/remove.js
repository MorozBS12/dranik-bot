const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('../permissions');

// Роли, которым разрешено убирать людей из тикетов (отредактируй под свой сервер)
const ALLOWED_ROLES = [
  '1481040977102897366', '1401145264571682886',
  '1484266536188514396','1484266955635556483',
  '1491115817910145134','1480616685999226971','1487138476133449870'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Убрать пользователя из текущего тикета')
    .addUserOption(opt => opt.setName('member').setDescription('Кого убрать').setRequired(true)),

  async execute(interaction) {
    const allowed = hasPermission(interaction.member, ALLOWED_ROLES)
                 || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!allowed) return interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });

    const member = interaction.options.getUser('member');
    const channel = interaction.channel;

    try {
      const existing = channel.permissionOverwrites.cache.get(member.id);
      if (!existing) {
        return interaction.reply({ content: `ℹ️ ${member} и так не имеет отдельного доступа к этому каналу.`, ephemeral: true });
      }

      await channel.permissionOverwrites.delete(member.id);
      await interaction.reply({ content: `✅ ${member} убран из этого тикета.` });
    } catch (error) {
      console.error('Ошибка /remove:', error);
      await interaction.reply({ content: '❌ Не удалось убрать пользователя. Проверьте права бота (Manage Channels) и его роль в иерархии.', ephemeral: true });
    }
  },
};
