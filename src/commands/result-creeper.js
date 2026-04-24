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
    const profileRes = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${nickname}`, { timeout: 5000 });
    const uuid = profileRes.data.id;
    const sessionRes = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000 });
    const props = sessionRes.data.properties;
    const texturesProp = props.find(p => p.name === 'textures');
    if (!texturesProp) return null;
    const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf8'));
    return decoded.textures?.SKIN?.url || null;
  } catch { return null; }
}

async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return await loadImage(Buffer.from(res.data));
  } catch { return null; }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

// Малює скін з текстури збоку (як на скріншоті)
function drawSkinFromTexture(ctx, skin, x, y, scale) {
  if (!skin) return;
  ctx.imageSmoothingEnabled = false;
  const s = scale;
  // Голова - передня частина
  ctx.drawImage(skin, 8, 8, 8, 8, x, y, 8*s, 8*s);
  // Другий шар голови
  ctx.drawImage(skin, 40, 8, 8, 8, x - s*0.5, y - s*0.5, 9*s, 9*s);
  // Тіло
  ctx.drawImage(skin, 20, 20, 8, 12, x, y + 8*s, 8*s, 12*s);
  // Ліва рука
  ctx.drawImage(skin, 44, 20, 4, 12, x - 4*s, y + 8*s, 4*s, 12*s);
  // Права рука
  ctx.drawImage(skin, 36, 52, 4, 12, x + 8*s, y + 8*s, 4*s, 12*s);
  // Ліва нога
  ctx.drawImage(skin, 4, 20, 4, 12, x, y + 20*s, 4*s, 12*s);
  // Права нога
  ctx.drawImage(skin, 20, 52, 4, 12, x + 4*s, y + 20*s, 4*s, 12*s);
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

async function generateResultCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, guildName, guildIconUrl, skinTexture, creeperImg }) {
  await ensureFont();
  const W = 900, H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(KIT_COLOR);

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, '#0d1117');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();

  // Left accent bar
  ctx.fillStyle = KIT_COLOR;
  ctx.beginPath();
  ctx.roundRect(0, 0, 6, H, [20, 0, 0, 20]);
  ctx.fill();

  // Glow bottom left
  const glow = ctx.createRadialGradient(200, H, 0, 200, H, 400);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Load tester img
  const testerImg = testerAvatarUrl ? await loadImageSafe(testerAvatarUrl) : null;

  // Draw skin зліва великий виходить за низ
  if (skinTexture) {
    const scale = 15;
    const skinTotalH = 32 * scale;
    const skinX = 10;
    const skinY = H - skinTotalH + 20;

    // Watermark
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 110px Noto';
    ctx.fillText(newTier, 10, H - 10);
    ctx.globalAlpha = 1;
    ctx.restore();

    drawSkinFromTexture(ctx, skinTexture, skinX, skinY, scale);
  }

  // TOP LEFT title
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px Noto';
  ctx.fillText('Результат тиртеста', 220, 54);

  // Nickname
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Noto';
  ctx.fillText(nickname, 220, 106);

  // Server card
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, 220, 120, 230, 60, 12);
  ctx.fill();

  if (creeperImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(234, 132, 36, 36, 8);
    ctx.clip();
    ctx.drawImage(creeperImg, 234, 132, 36, 36);
    ctx.restore();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.fillRect(234, 132, 36, 36);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText('Дрянный СабТирс', 278, 148);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '12px Noto';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru',{month:'long'})} ${now.getFullYear()} г.`, 278, 167);

  // Previous tier
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Noto';
  ctx.fillText('Предыдущий тир', 530, 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Noto';
  ctx.fillText(oldTier === '—' ? 'Відсутній' : `Creeper ${oldTier}`, 530, 110);

  // New tier BIG
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Noto';
  ctx.fillText('Приобретённый тир', 530, 155);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Noto';
  ctx.fillText(newTier, 530, 245);
  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 28px Noto';
  ctx.fillText(KIT_NAME, 530, 285);

  // Tester card
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, 700, 24, 180, 56, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Noto';
  ctx.fillText('Тиртестер', 716, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Noto';
  ctx.fillText(testerName, 716, 64);

  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(858, 52, 18, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, 840, 34, 36, 36);
    ctx.restore();
    ctx.strokeStyle = KIT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(858, 52, 19, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.beginPath();
    ctx.arc(858, 52, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Noto';
    ctx.textAlign = 'center';
    ctx.fillText((testerName[0] || '?').toUpperCase(), 858, 58);
    ctx.textAlign = 'left';
  }

  // Bottom line
  ctx.fillStyle = KIT_COLOR;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, H - 4, W, 4);
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

      const [skinUrl, creeperImg] = await Promise.all([
        getSkinUrl(nickname),
        loadImageSafe('https://mc-heads.net/avatar/MHF_Creeper/36'),
      ]);
      const skinTexture = skinUrl ? await loadImageSafe(skinUrl) : null;

      const testerAvatarUrl = tester.displayAvatarURL({ extension: 'png', size: 64 });
      const guildIconUrl = interaction.guild.iconURL({ extension: 'png', size: 64 });

      const cardBuffer = await generateResultCard({
        nickname, oldTier, newTier: tier,
        testerName: tester.username,
        testerAvatarUrl, guildName: interaction.guild.name,
        guildIconUrl, skinTexture, creeperImg,
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
