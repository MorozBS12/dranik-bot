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

async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return await loadImage(Buffer.from(res.data));
  } catch { return null; }
}

// Отримує текстуру скіна через Mojang API
async function getSkinTexture(nickname) {
  try {
    // 1. Отримати UUID
    const profileRes = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${nickname}`, { timeout: 5000 });
    const uuid = profileRes.data.id;

    // 2. Отримати profile з текстурами
    const sessionRes = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000 });
    const props = sessionRes.data.properties;
    const texturesProp = props.find(p => p.name === 'textures');
    if (!texturesProp) return null;

    // 3. Декодувати base64
    const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf8'));
    const skinUrl = decoded.textures?.SKIN?.url;
    if (!skinUrl) return null;

    // 4. Завантажити текстуру
    return await loadImageSafe(skinUrl);
  } catch (e) {
    console.error('getSkinTexture error:', e.message);
    return null;
  }
}

// Малює скін з текстури (фронтальний вигляд)
function drawSkin(ctx, skin, x, y, scale) {
  if (!skin) return;
  const s = scale;
  const isSlim = false; // можна додати перевірку

  // Голова (з другим шаром)
  ctx.imageSmoothingEnabled = false;
  // Тіло голови [8,8,8,8]
  ctx.drawImage(skin, 8, 8, 8, 8, x, y, 8*s, 8*s);
  // Другий шар голови [40,8,8,8]
  ctx.drawImage(skin, 40, 8, 8, 8, x-s*0.5, y-s*0.5, 9*s, 9*s);

  // Тіло [20,20,8,12]
  ctx.drawImage(skin, 20, 20, 8, 12, x, y+8*s, 8*s, 12*s);

  // Ліва рука [44,20,4,12] (права на скіні)
  ctx.drawImage(skin, 44, 20, 4, 12, x-4*s, y+8*s, 4*s, 12*s);
  // Права рука [36,52,4,12] або [28,52]
  ctx.drawImage(skin, 36, 52, 4, 12, x+8*s, y+8*s, 4*s, 12*s);

  // Ліва нога [4,20,4,12]
  ctx.drawImage(skin, 4, 20, 4, 12, x, y+20*s, 4*s, 12*s);
  // Права нога [20,52,4,12]
  ctx.drawImage(skin, 20, 52, 4, 12, x+4*s, y+20*s, 4*s, 12*s);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

async function generateResultCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, skinTexture, creeperImg }) {
  await ensureFont();
  const W = 800, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(KIT_COLOR);

  // Background
  const grad = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.9);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(1, '#0a1a0f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  // Left accent bar
  ctx.fillStyle = KIT_COLOR;
  ctx.beginPath();
  ctx.roundRect(0, 0, 5, H, [16, 0, 0, 16]);
  ctx.fill();

  // ===== SKIN зліва знизу (половина) =====
  if (skinTexture) {
    const scale = 14;
    const skinTotalH = 32 * scale; // повна висота
    const skinW = 16 * scale;
    const skinX = 20;
    // Малюємо так щоб нижня частина виходила за межі
    const skinY = H - skinTotalH * 0.62; // показуємо верхні ~62%

    ctx.save();
    ctx.rect(0, 0, skinX + skinW + 20, H);
    ctx.clip();

    // Водяний знак
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Noto';
    ctx.fillText(newTier, 10, H - 20);
    ctx.globalAlpha = 1;

    ctx.imageSmoothingEnabled = false;
    drawSkin(ctx, skinTexture, skinX, skinY, scale);
    ctx.restore();
  }

  // ===== TOP LEFT =====
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px Noto';
  ctx.fillText('Результат тиртеста', 24, 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Noto';
  ctx.fillText(nickname, 24, 68);

  // Server card
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(24, 82, 195, 44, 8);
  ctx.fill();
  if (creeperImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(34, 91, 26, 26, 5);
    ctx.clip();
    ctx.drawImage(creeperImg, 34, 91, 26, 26);
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Noto';
  ctx.fillText('Дрянный СабТирс', 68, 107);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px Noto';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru',{month:'long'})} ${now.getFullYear()} г.`, 68, 120);

  // ===== CENTER: tiers =====
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px Noto';
  ctx.fillText('Предыдущий тир', 330, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Noto';
  ctx.fillText(oldTier === '—' ? 'Отсутствует' : `Creeper ${oldTier}`, 330, 56);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px Noto';
  ctx.fillText('Приобретённый тир', 330, 98);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 58px Noto';
  ctx.fillText(newTier, 330, 168);
  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 22px Noto';
  ctx.fillText(KIT_NAME, 330, 200);

  // ===== TOP RIGHT: tester =====
  const [testerImg] = await Promise.all([
    testerAvatarUrl ? loadImageSafe(testerAvatarUrl) : null,
  ]);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(W - 178, 16, 162, 46, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px Noto';
  ctx.fillText('Тиртестер', W - 166, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText(testerName, W - 166, 50);
  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 22, 39, 16, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, W - 38, 23, 32, 32);
    ctx.restore();
    ctx.strokeStyle = KIT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(W - 22, 39, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bottom line
  ctx.fillStyle = KIT_COLOR;
  ctx.globalAlpha = 0.3;
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

      const [skinTexture, creeperImg] = await Promise.all([
        getSkinTexture(nickname),
        loadImageSafe('https://mc-heads.net/avatar/MHF_Creeper/28'),
      ]);

      const testerAvatarUrl = tester.displayAvatarURL({ extension: 'png', size: 64 });

      const cardBuffer = await generateResultCard({
        nickname, oldTier, newTier: tier,
        testerName: tester.username,
        testerAvatarUrl, skinTexture, creeperImg,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: 'result.png' });
      await interaction.channel.send({ content: `<@${targetUserId}>`, files: [attachment] });
      await interaction.editReply({ content: `✅ Результат Creeper отправлен! Роль **Creeper ${tier}** видана.` });
      if (targetMember) await targetMember.send({ content: `Вы получили новый тир Creeper: **${tier}** на сервере ${interaction.guild.name}` }).catch(() => {});
    } catch (error) {
      console.error('Ошибка result-creeper:', error);
      await interaction.editReply({ content: `❌ Ошибка: ${error.message || 'Проверьте права бота!'}` });
    }
  },
};
