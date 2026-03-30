const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { upsertPlayer, getPlayer, incrementTester, addMatch } = require('../database');

const VALID_TIERS = ['HT3','LT2','HT2','LT1','HT1'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('result-high')
    .setDescription('Выдать ранг игроку (HT3+)')
    .addUserOption(opt => opt.setName('member').setDescription('Игрок').setRequired(true)),

  async execute(interaction) {
    const allowedRoles = [
      '1481040977102897366',
      '1480616685999226971',
      '1481041265469423667',
      '1401145264571682886',
    ];

    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))
                          || interaction.member.permissions.has('Administrator');

    if (!hasPermission) {
      return interaction.reply({
        content: '❌ У вас нет прав для использования этой команды!',
        ephemeral: true,
      });
    }

    const member = interaction.options.getUser('member');

    const modal = new ModalBuilder()
      .setCustomId(`result-high_${member.id}`)
      .setTitle('Результат тестирования');

    const nicknameInput = new TextInputBuilder()
      .setCustomId('nickname')
      .setLabel('Никнейм игрока')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const tierInput = new TextInputBuilder()
      .setCustomId('tier')
      .setLabel('Тир: HT3 LT2 HT2 LT1 HT1')
      .setPlaceholder('Например: HT3')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const commentInput = new TextInputBuilder()
      .setCustomId('comment')
      .setLabel('Комментарий')
      .setPlaceholder('Например: MorozBS 10 - 0 Fixified_')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nicknameInput),
      new ActionRowBuilder().addComponents(tierInput),
      new ActionRowBuilder().addComponents(commentInput)
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUserId = interaction.customId.split('_')[1];
      const nickname = interaction.fields.getTextInputValue('nickname').trim();
      const tier = interaction.fields.getTextInputValue('tier').toUpperCase().trim();
      const comment = interaction.fields.getTextInputValue('comment').trim() || 'Не указан';
      const tester = interaction.user;

      if (!VALID_TIERS.includes(tier)) {
        return interaction.editReply({
          content: `❌ Неверный тир \`${tier}\`. Допустимые: ${VALID_TIERS.join(', ')}`,
        });
      }

      const existing = getPlayer(nickname);
      const oldTier = existing?.tier || '—';

      upsertPlayer(nickname, tier);
      incrementTester(tester.id, tester.username);
      addMatch(nickname, tester.username, tier, comment);

      const playerSkinUrl = `https://vzge.me/bust/256/${nickname}`;

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({
          name: `Результат теста ${nickname} 🏆`,
          iconURL: interaction.guild.iconURL(),
        })
        .setThumbnail(playerSkinUrl)
        .addFields(
          { name: 'Тестер',          value: `${tester}`,   inline: false },
          { name: 'Никнейм',         value: `${nickname}`,  inline: false },
          { name: 'Предыдущий ранг', value: `${oldTier}`,   inline: false },
          { name: 'Новый ранг',      value: `${tier}`,      inline: false },
          { name: 'Комментарий',     value: comment,        inline: false },
        )
        .setTimestamp();

      await interaction.channel.send({
        content: `<@${targetUserId}>`,
        embeds: [embed],
      });

      await interaction.editReply({ content: `✅ Результат успешно отправлен в канал!` });

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (targetMember) {
        await targetMember.send({
          content: `Вы получили новый тир: **${tier}** на сервере ${interaction.guild.name}`,
        }).catch(() => {});
      }

    } catch (error) {
      console.error('Ошибка в handleModal result-high:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Ошибка: ${error.message || 'Проверьте права бота!'}` });
      }
    }
  },
};
