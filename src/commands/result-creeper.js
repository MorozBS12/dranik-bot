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
    if (data.success) {
      const uuid = data.data.player.id;
      return `https://crafatar.com/renders/body/${uuid}?overlay&scale=10`;
    }
  } catch {}
  return `https://crafatar.com/renders/body/${nickname}?overlay&scale=10`;
}

async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    return await loadImage(Buffer.from(res.data));
  } catch { return null; }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

async function generateResultCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, skinUrl }) {
  await ensureFont();
  const W = 800, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(KIT_COLOR);

  // Background радіальний градієнт як на прикладі
  const grad = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.9);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(1, '#0a1a0f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  // Load images
  const [skinImg, testerImg, creeperImg] = await Promise.all([
    loadImageSafe(skinUrl),
    testerAvatarUrl ? loadImageSafe(testerAvatarUrl) : null,
    loadImageSafe('https://mc-heads.net/avatar/MHF_Creeper/28'),
  ]);

  // ===== TOP SECTION =====
  // Title small
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px Noto';
  ctx.fillText('Результат тиртеста', 24, 36);

  // Nickname big
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Noto';
  ctx.fillText(nickname, 24, 78);

  // Server card top left
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(24, 92, 200, 46, 8);
  ctx.fill();
  if (creeperImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(34, 101, 28, 28, 5);
    ctx.clip();
    ctx.drawImage(creeperImg, 34, 101, 28, 28);
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Noto';
  ctx.fillText('Дрянный СабТирс', 70, 114);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px Noto';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru',{month:'long'})} ${now.getFullYear()} г.`, 70, 128);

  // ===== CENTER RIGHT: tiers =====
  // Previous tier
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px Noto';
  ctx.fillText('Предыдущий тир', 340, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Noto';
  ctx.fillText(oldTier === '—' ? 'Отсутствует' : `Creeper ${oldTier}`, 340, 60);

  // New tier
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px Noto';
  ctx.fillText('Приобретённый тир', 340, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px Noto';
  ctx.fillText(newTier, 340, 162);
  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 20px Noto';
  ctx.fillText(KIT_NAME, 340, 190);

  // ===== TOP RIGHT: tester =====
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(W - 180, 16, 164, 46, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px Noto';
  ctx.fillText('Тиртестер', W - 168, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText(testerName, W - 168, 50);
  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 24, 39, 16, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, W - 40, 23, 32, 32);
    ctx.restore();
    ctx.strokeStyle = KIT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(W - 24, 39, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== SKIN BOTTOM LEFT =====
  if (skinImg) {
    const skinH = 420;
    const skinW = skinImg.width * (skinH / skinImg.height);
    // Клip - показуємо тільки верхні 60% скіна
    const visibleH = skinH * 0.62;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H - visibleH, skinW + 20, visibleH + 10);
    ctx.clip();
    // Водяний знак
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 90px Noto';
    ctx.fillText(newTier, 40, 450);
    ctx.globalAlpha = 1;
    ctx.drawImage(skinImg, 10, H - skinH, skinW, skinH);
    ctx.restore();
  }

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

      const cardBuffer = await generateResultCard({
        nickname, oldTier, newTier: tier,
        testerName: tester.username,
        testerAvatarUrl, skinUrl,
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
