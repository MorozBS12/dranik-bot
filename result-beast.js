const {
  SlashCommandBuilder, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const { upsertPlayer, getPlayer, incrementTester, addMatch } = require('../database');

const VALID_TIERS = ['LT1','HT1','LT2','HT2','LT3','HT3','LT4','HT4','LT5','HT5'];

async function getSkinUrl(nickname) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://playerdb.co/api/player/minecraft/${nickname}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.success) return `https://vzge.me/bust/256/${nickname}`;
  } catch {}
  return `https://minotar.net/bust/${nickname}/100.png`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('result-beast')
    .setDescription('Выдать ранг игроку (BEAST)')
    .addUserOption(opt => opt.setName('member').setDescription('Игрок').setRequired(true)),

  async execute(interaction) {
    const allowedRoles = ['1481040977102897366','1480616685999226971','1481041265469423667','1401145264571682886'];
    const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))
                          || interaction.member.permissions.has('Administrator');
    if (!hasPermission) return interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });

    const member = interaction.options.getUser('member');
    const modal = new ModalBuilder().setCustomId(`result-beast_${member.id}`).setTitle('Результат тестирования (BEAST)');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм игрока').setPlaceholder('Введите никнейм').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Тир: Например HT4').setPlaceholder('HT4').setStyle(TextInputStyle.Short).setRequired(true)),
    );
    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const targetUserId = interaction.customId.split('_')[1];
      const nickname = interaction.fields.getTextInputValue('nickname').trim();
      const tier = interaction.fields.getTextInputValue('tier').toUpperCase().trim();
      const tester = interaction.user;

      if (!VALID_TIERS.includes(tier)) return interaction.editReply({ content: `❌ Неверный тир \`${tier}\`. Допустимые: ${VALID_TIERS.join(', ')}` });

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (targetMember) {
        const roleToAssign = interaction.guild.roles.cache.find(r => r.name === `Beast ${tier}`);
        if (roleToAssign) {
          const oldTierRoles = targetMember.roles.cache.filter(r => VALID_TIERS.some(t => r.name === `Beast ${t}`));
          if (oldTierRoles.size > 0) await targetMember.roles.remove(oldTierRoles).catch(console.error);
          await targetMember.roles.add(roleToAssign).catch(e => { throw new Error('Бот не может выдать роль. Проверьте иерархию!'); });
        } else {
          console.warn(`Роль "Beast ${tier}" не найдена на сервере!`);
        }
      }

      const existing = getPlayer(nickname);
      const oldTier = existing?.tier || '—';
      upsertPlayer(nickname, tier);
      incrementTester(tester.id, tester.username);
      addMatch(nickname, tester.username, tier, 'Не указан');

      const playerSkinUrl = await getSkinUrl(nickname);

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({ name: `Результат теста BEAST ${nickname} 🏆`, iconURL: interaction.guild.iconURL() })
        .setThumbnail(playerSkinUrl)
        .addFields(
          { name: 'Тестер',          value: `${tester}`,     inline: false },
          { name: 'Никнейм',         value: `${nickname}`,   inline: false },
          { name: 'Предыдущий ранг', value: `${oldTier}`,    inline: false },
          { name: 'Новый ранг',      value: `Beast ${tier}`, inline: false },
        )
        .setTimestamp();

      await interaction.channel.send({ content: `<@${targetUserId}>`, embeds: [embed] });
      await interaction.editReply({ content: `✅ Результат BEAST отправлен! Роль **Beast ${tier}** выдана.` });
      if (targetMember) await targetMember.send({ content: `Вы получили новый тир BEAST: **${tier}** на сервере ${interaction.guild.name}` }).catch(() => {});
    } catch (error) {
      console.error('Ошибка result-beast:', error);
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: `❌ Ошибка: ${error.message || 'Проверьте права бота!'}` });
    }
  },
};
