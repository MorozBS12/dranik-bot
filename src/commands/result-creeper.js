const {
  SlashCommandBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder,
} = require('discord.js');
const { upsertPlayer, getPlayer, incrementTester, addMatch } = require('../database');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

const VALID_TIERS = ['LT1','HT1','LT2','HT2','LT3','HT3','LT4','HT4','LT5','HT5'];
const KIT_COLOR = '#2ecc71';
const KIT_NAME = 'Creeper';

async function getSkinUrl(nickname) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`https://playerdb.co/api/player/minecraft/${nickname}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.success) return `https://vzge.me/full/256/${nickname}`;
  } catch {}
  return `https://minotar.net/body/${nickname}/256.png`;
}

async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
    return await loadImage(Buffer.from(res.data));
  } catch {
    return null;
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

async function generateResultCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, guildName, guildIconUrl, skinUrl }) {
  const W = 900, H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const { r, g, b } = hexToRgb(KIT_COLOR);

  // Background gradient dark
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, '#0d1117');
  ctx.fillStyle = grad;
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();

  // Left color accent bar
  ctx.fillStyle = KIT_COLOR;
  ctx.roundRect(0, 0, 6, H, [20, 0, 0, 20]);
  ctx.fill();

  // Subtle color glow bottom left
  const glow = ctx.createRadialGradient(200, H, 0, 200, H, 400);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- Load images ---
  const [skinImg, guildImg, testerImg] = await Promise.all([
    loadImageSafe(skinUrl),
    guildIconUrl ? loadImageSafe(guildIconUrl) : null,
    testerAvatarUrl ? loadImageSafe(testerAvatarUrl) : null,
  ]);

  // --- Draw skin (left side, big) ---
  if (skinImg) {
    const skinH = 360;
    const skinW = skinImg.width * (skinH / skinImg.height);
    ctx.drawImage(skinImg, 40, H - skinH - 10, skinW, skinH);
  }

  // --- TOP LEFT: title ---
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 16px Arial';
  ctx.fillText('Результат тиртеста', 260, 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial';
  ctx.fillText(nickname, 260, 106);

  // --- Server card ---
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, 260, 120, 230, 60, 12);
  ctx.fill();

  // Creeper kit icon
  const creeperIconUrl = 'https://mc-heads.net/avatar/MHF_Creeper/36';
  const creeperIcon = await loadImageSafe(creeperIconUrl);
  if (creeperIcon) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(274, 132, 36, 36, 8);
    ctx.clip();
    ctx.drawImage(creeperIcon, 274, 132, 36, 36);
    ctx.restore();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.beginPath();
    ctx.roundRect(274, 132, 36, 36, 8);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial';
  ctx.fillText('Дрянный СабТирс', 320, 148);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '12px Arial';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru',{month:'long'})} ${now.getFullYear()} г.`, 320, 167);

  // --- RIGHT: previous tier ---
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 14px Arial';
  ctx.fillText('Предыдущий тир', 530, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(oldTier === '—' ? '—' : oldTier, 530, 115);

  // --- RIGHT: new tier BIG ---
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 14px Arial';
  ctx.fillText('Приобретённый тир', 530, 165);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(newTier, 530, 250);

  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(KIT_NAME, 530, 290);

  // --- TOP RIGHT: tester card ---
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, 700, 24, 180, 56, 12);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Arial';
  ctx.fillText('Тиртестер', 716, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(testerName, 716, 64);

  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(858, 52, 18, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, 840, 34, 36, 36);
    ctx.restore();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.beginPath();
    ctx.arc(858, 52, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(testerName[0]?.toUpperCase() || '?', 858, 58);
    ctx.textAlign = 'left';
  }

  // Bottom thin colored line
  ctx.fillStyle = KIT_COLOR;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, H - 4, W, 4);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('result-creeper')
    .setDescription('Выдать ранг игроку (Creeper)')
    .addUserOption(opt => opt.setName('member').setDescription('Игрок').setRequired(true)),

  async execute(interaction) {
    const allowedRoles = ['1481040977102897366','1480616685999226971','1481041265469423667','1491115725476335768','1401145264571682886'];
    const hasPermission = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))
                       || interaction.member.permissions.has('Administrator');
    if (!hasPermission) return interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });

    const member = interaction.options.getUser('member');
    const modal = new ModalBuilder().setCustomId(`result-creeper_${member.id}`).setTitle('Результат тестирования (Creeper)');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм игрока').setPlaceholder('Введите никнейм').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Тир: Например HT4').setPlaceholder('HT4').setStyle(TextInputStyle.Short).setRequired(true)),
    );
    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUserId = interaction.customId.split('_')[1];
    const nickname = interaction.fields.getTextInputValue('nickname').trim();
    const tier = interaction.fields.getTextInputValue('tier').toUpperCase().trim();
    const tester = interaction.user;

    if (!VALID_TIERS.includes(tier)) return interaction.editReply({ content: `❌ Неверный тир \`${tier}\`. Допустимые: ${VALID_TIERS.join(', ')}` });

    try {
      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (targetMember) {
        const roleToAssign = interaction.guild.roles.cache.find(r => r.name === `Creeper ${tier}`);
        if (roleToAssign) {
          const oldRoles = targetMember.roles.cache.filter(r => VALID_TIERS.some(t => r.name === `Creeper ${t}`));
          if (oldRoles.size > 0) await targetMember.roles.remove(oldRoles).catch(console.error);
          await targetMember.roles.add(roleToAssign).catch(() => { throw new Error('Бот не может выдать роль. Проверьте иерархию!'); });
        } else console.warn(`Роль "Creeper ${tier}" не найдена!`);
      }

      const existing = getPlayer(nickname);
      const oldTier = existing?.tier || '—';
      upsertPlayer(nickname, tier);
      incrementTester(tester.id, tester.username);
      addMatch(nickname, tester.username, tier, 'Не указан');

      const skinUrl = await getSkinUrl(nickname);
      const testerAvatarUrl = tester.displayAvatarURL({ extension: 'png', size: 64 });
      const guildIconUrl = interaction.guild.iconURL({ extension: 'png', size: 64 });

      const cardBuffer = await generateResultCard({
        nickname,
        oldTier,
        newTier: tier,
        testerName: tester.username,
        testerAvatarUrl,
        guildName: interaction.guild.name,
        guildIconUrl,
        skinUrl,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: 'result.png' });

      await interaction.channel.send({ content: `<@${targetUserId}>`, files: [attachment] });
      await interaction.editReply({ content: `✅ Результат Creeper отправлен! Роль **Creeper ${tier}** выдана.` });
      if (targetMember) await targetMember.send({ content: `Вы получили новый тир Creeper: **${tier}** на сервере ${interaction.guild.name}` }).catch(() => {});
    } catch (error) {
      console.error('Ошибка result-creeper:', error);
      await interaction.editReply({ content: `❌ Ошибка: ${error.message || 'Проверьте права бота!'}` });
    }
  },
};
