const {
  SlashCommandBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder,
} = require('discord.js');
const { upsertPlayer, getPlayer, incrementTester, addMatch } = require('../database');
const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_TIERS = ['LT1','HT1','LT2','HT2','LT3','HT3','LT4','HT4','LT5','HT5'];
const KIT_COLOR = '#2ecc71';
const KIT_NAME = 'Creeper';

let fontReady = false;
async function ensureFont() {
  if (fontReady) return;
  try {
    const fontPath = path.join(os.tmpdir(), 'NotoSans.ttf');
    if (!fs.existsSync(fontPath)) {
      const res = await axios.get('https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf', { responseType: 'arraybuffer', timeout: 10000 });
      fs.writeFileSync(fontPath, Buffer.from(res.data));
    }
    registerFont(fontPath, { family: 'Noto' });
    const boldPath = path.join(os.tmpdir(), 'NotoSans-Bold.ttf');
    if (!fs.existsSync(boldPath)) {
      const res2 = await axios.get('https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf', { responseType: 'arraybuffer', timeout: 10000 });
      fs.writeFileSync(boldPath, Buffer.from(res2.data));
    }
    registerFont(boldPath, { family: 'Noto', weight: 'bold' });
    fontReady = true;
  } catch (e) {
    console.error('Font load failed:', e.message);
  }
}

async function getSkinUrl(nickname) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://playerdb.co/api/player/minecraft/${nickname}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.success) return `https://mc-heads.net/body/${data.data.player.id}/left`;
  } catch {}
  return `https://minotar.net/body/${nickname}/100.png`;
}

async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
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

async function generateResultCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, guildIconUrl, skinUrl }) {
  await ensureFont();
  const W = 900, H = 380;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(KIT_COLOR);

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(1, '#0d1117');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  // Glow bottom left
  const glow = ctx.createRadialGradient(180, H, 0, 180, H, 350);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Left accent
  ctx.fillStyle = KIT_COLOR;
  ctx.beginPath();
  ctx.roundRect(0, 0, 5, H, [16, 0, 0, 16]);
  ctx.fill();

  // Load images
  const [skinImg, testerImg, creeperImg] = await Promise.all([
    loadImageSafe(skinUrl),
    testerAvatarUrl ? loadImageSafe(testerAvatarUrl) : null,
    loadImageSafe('https://mc-heads.net/avatar/MHF_Creeper/32'),
  ]);

  // Draw skin left side
  if (skinImg) {
    const skinH = 300;
    const skinW = skinImg.width * (skinH / skinImg.height);
    ctx.drawImage(skinImg, 30, H - skinH - 20, skinW, skinH);
  }

  // TOP LEFT title
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Noto';
  ctx.fillText('Результат тиртеста', 230, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Noto';
  ctx.fillText(nickname, 230, 86);

  // Server card
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(230, 100, 220, 54, 10);
  ctx.fill();

  if (creeperImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(244, 111, 32, 32, 6);
    ctx.clip();
    ctx.drawImage(creeperImg, 244, 111, 32, 32);
    ctx.restore();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.beginPath();
    ctx.roundRect(244, 111, 32, 32, 6);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Noto';
  ctx.fillText('Дрянный СабТирс', 284, 126);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '11px Noto';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru',{month:'long'})} ${now.getFullYear()} г.`, 284, 143);

  // RIGHT: Previous tier
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px Noto';
  ctx.fillText('Предыдущий тир', 500, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Noto';
  ctx.fillText(oldTier === '—' ? '—' : `Creeper ${oldTier}`, 500, 88);

  // RIGHT: New tier BIG
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px Noto';
  ctx.fillText('Приобретённый тир', 500, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Noto';
  ctx.fillText(newTier, 500, 210);
  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 22px Noto';
  ctx.fillText(KIT_NAME, 500, 246);

  // TOP RIGHT: Tester card
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(680, 20, 200, 52, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px Noto';
  ctx.fillText('Тиртестер', 696, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText(testerName, 696, 58);

  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(856, 46, 18, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, 838, 28, 36, 36);
    ctx.restore();
    // Circle border
    ctx.strokeStyle = KIT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(856, 46, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bottom line
  ctx.fillStyle = KIT_COLOR;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, H - 3, W, 3);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
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
        nickname, oldTier, newTier: tier,
        testerName: tester.username,
        testerAvatarUrl, guildIconUrl, skinUrl,
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
