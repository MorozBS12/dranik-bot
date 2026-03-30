const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getTopTesters } = require('../database');

const MEDALS = ['🥇', '🥈', '🥉'];
const PLACE_EMOJIS = ['4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top_tester')
    .setDescription('Посмотреть Топ Тестеров Сервера'),

  async execute(interaction) {
    const allowedRoles = [
      '1401145264571682886',
      '1481361984002981908',
      '1481041430125482127',
      '1481041265469423667',
      '1480616685999226971',
    ];

    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))
                          || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return interaction.reply({
        content: '❌ У вас нет прав для просмотра топа тестеров!',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const testers = getTopTesters(10);

    if (testers.length === 0) {
      return interaction.editReply({
        content: '❌ Пока что нету тестеров. Начинайте тестить игроков!',
      });
    }

    const lines = testers.map((t, i) => {
      const medal = i < 3 ? MEDALS[i] : (PLACE_EMOJIS[i - 3] || `**${i + 1}.**`);
      const bar = '█'.repeat(Math.min(Math.floor(t.tests_count / 3), 10));
      return `${medal} **${t.nickname}** — \`${t.tests_count}\` тестов\n> ${bar || '░'}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 ТОП ТЕСТЕРОВ — Бот для Драника')
      .setDescription(lines.join('\n\n'))
      .addFields({
        name: '📊 Статистика',
        value: `Всего тестеров: **${testers.length}**\nВсего тестов: **${testers.reduce((a, t) => a + t.tests_count, 0)}**`,
        inline: false,
      })
      .setFooter({ text: 'Dranik Rating System' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
