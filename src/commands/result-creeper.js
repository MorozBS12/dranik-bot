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

// Загрузка шрифтов
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
    console.error('Ошибка загрузки шрифта:', e.message);
  }
}

// Получение текстуры скина через Mojang API
async function getSkinTexture(nickname) {
  try {
    const profileRes = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${nickname}`, { timeout: 5000 });
    const uuid = profileRes.data.id;
    const sessionRes = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000 });
    const props = sessionRes.data.properties;
    const texturesProp = props.find(p => p.name === 'textures');
    if (!texturesProp) return null;
    const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf8'));
    const skinUrl = decoded.textures?.SKIN?.url;
    if (!skinUrl) return null;
    const res = await axios.get(skinUrl, { responseType: 'arraybuffer', timeout: 8000 });
    return await loadImage(Buffer.from(res.data));
  } catch { return null; }
}

// Безопасная загрузка изображения
async function loadImageSafe(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return await loadImage(Buffer.from(res.data));
  } catch { return null; }
}

// Отрисовка скина из текстуры (фронтальный вид)
function drawSkin(ctx, skin, x, y, s) {
  if (!skin) return;
  ctx.imageSmoothingEnabled = false;
  // Голова
  ctx.drawImage(skin, 8, 8, 8, 8, x, y, 8*s, 8*s);
  ctx.drawImage(skin, 40, 8, 8, 8, x - s*0.5, y - s*0.5, 9*s, 9*s);
  // Тело
  ctx.drawImage(skin, 20, 20, 8, 12, x, y + 8*s, 8*s, 12*s);
  // Руки
  ctx.drawImage(skin, 44, 20, 4, 12, x - 4*s, y + 8*s, 4*s, 12*s);
  ctx.drawImage(skin, 36, 52, 4, 12, x + 8*s, y + 8*s, 4*s, 12*s);
  // Ноги
  ctx.drawImage(skin, 4, 20, 4, 12, x, y + 20*s, 4*s, 12*s);
  ctx.drawImage(skin, 20, 52, 4, 12, x + 4*s, y + 20*s, 4*s, 12*s);
}

// Округленный прямоугольник
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

async function generateCard({ nickname, oldTier, newTier, testerName, testerAvatarUrl, skinTexture, kitIcon }) {
  await ensureFont();

  const W = 900, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Фон - радиальный градиент как на скриншоте
  const grad = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.35, H * 0.3, W);
  grad.addColorStop(0, '#3aaa5c');
  grad.addColorStop(0.5, '#1a7a3a');
  grad.addColorStop(1, '#0a2a15');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();

  // Загрузка изображений
  const testerImg = testerAvatarUrl ? await loadImageSafe(testerAvatarUrl) : null;

  // === СКИН слева снизу (наполовину виден) ===
  if (skinTexture) {
    const scale = 14;
    const skinH = 32 * scale;
    const skinX = 20;
    // Рисуем так чтобы нижняя часть выходила за пределы
    const skinY = H - skinH * 0.65;

    // Водяной знак
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 100px Noto';
    ctx.fillText(newTier, 15, H - 15);
    ctx.globalAlpha = 1;
    ctx.restore();

    drawSkin(ctx, skinTexture, skinX, skinY, scale);
  }

  // === ВЕРХНИЙ ЛЕВЫЙ: заголовок ===
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px Noto';
  ctx.fillText('Результат тиртеста', 250, 36);

  // Ник игрока
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Noto';
  ctx.fillText(nickname, 250, 82);

  // Карточка кита
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, 250, 96, 210, 52, 10);
  ctx.fill();

  // Иконка крипера
  if (kitIcon) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(262, 108, 28, 28, 6);
    ctx.clip();
    ctx.drawImage(kitIcon, 262, 108, 28, 28);
    ctx.restore();
  } else {
    ctx.fillStyle = KIT_COLOR;
    ctx.fillRect(262, 108, 28, 28);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText('Creeper Kit', 298, 122);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px Noto';
  const now = new Date();
  ctx.fillText(`${now.getDate()} ${now.toLocaleString('ru', { month: 'long' })} ${now.getFullYear()} г.`, 298, 137);

  // === ПРАВАЯ ЧАСТЬ: тиры ===
  // Предыдущий тир
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px Noto';
  ctx.fillText('Предыдущий тир', 500, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Noto';
  ctx.fillText(oldTier === '—' ? 'Отсутствует' : `Creeper ${oldTier}`, 500, 62);

  // Новый тир (большой)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px Noto';
  ctx.fillText('Приобретённый тир', 500, 106);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Noto';
  ctx.fillText(newTier, 500, 186);
  ctx.fillStyle = KIT_COLOR;
  ctx.font = 'bold 24px Noto';
  ctx.fillText(KIT_NAME, 500, 222);

  // === ВЕРХНИЙ ПРАВЫЙ: тестер ===
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, W - 195, 18, 178, 50, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px Noto';
  ctx.fillText('Тиртестер', W - 183, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Noto';
  ctx.fillText(testerName, W - 183, 54);

  if (testerImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 22, 43, 18, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(testerImg, W - 40, 25, 36, 36);
    ctx.restore();
    ctx.strokeStyle = KIT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W - 22, 43, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Нижняя линия
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
    const modal = new ModalBuilder()
      .setCustomId(`result-creeper_${member.id}`)
      .setTitle('Результат тестирования (Creeper)');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('nickname').setLabel('Никнейм игрока').setPlaceholder('Введите никнейм').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('tier').setLabel('Тир: Например HT4').setPlaceholder('HT4').setStyle(TextInputStyle.Short).setRequired(true)
      ),
    );
    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUserId = interaction.customId.split('_')[1];
    const nickname = interaction.fields.getTextInputValue('nickname').trim();
    const tier = interaction.fields.getTextInputValue('tier').toUpperCase().trim();
    const tester = interaction.user;

    if (!VALID_TIERS.includes(tier)) {
      return interaction.editReply({ content: `❌ Неверный тир \`${tier}\`. Допустимые: ${VALID_TIERS.join(', ')}` });
    }

    try {
      // Выдача роли
      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (targetMember) {
        const roleToAssign = interaction.guild.roles.cache.find(r => r.name === `Creeper ${tier}`);
        if (roleToAssign) {
          const oldRoles = targetMember.roles.cache.filter(r => VALID_TIERS.some(t => r.name === `Creeper ${t}`));
          if (oldRoles.size > 0) await targetMember.roles.remove(oldRoles).catch(console.error);
          await targetMember.roles.add(roleToAssign).catch(() => {
            throw new Error('Бот не может выдать роль. Проверьте иерархию!');
          });
        } else {
          console.warn(`Роль "Creeper ${tier}" не найдена!`);
        }
      }

      // База данных
      const existing = getPlayer(nickname);
      const oldTier = existing?.tier || '—';
      upsertPlayer(nickname, tier);
      incrementTester(tester.id, tester.username);
      addMatch(nickname, tester.username, tier, 'Не указан');

      // Загрузка изображений
      const [skinTexture, kitIcon] = await Promise.all([
        getSkinTexture(nickname),
        loadImageSafe('https://mc-heads.net/avatar/MHF_Creeper/32'),
      ]);

      const testerAvatarUrl = tester.displayAvatarURL({ extension: 'png', size: 64 });

      // Генерация карточки
      const cardBuffer = await generateCard({
        nickname, oldTier, newTier: tier,
        testerName: tester.username,
        testerAvatarUrl, skinTexture, kitIcon,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: 'result.png' });
      await interaction.channel.send({ content: `<@${targetUserId}>`, files: [attachment] });
      await interaction.editReply({ content: `✅ Результат Creeper отправлен! Роль **Creeper ${tier}** выдана.` });

      if (targetMember) {
        await targetMember.send({
          content: `Вы получили новый тир Creeper: **${tier}** на сервере ${interaction.guild.name}`
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Ошибка result-creeper:', error);
      await interaction.editReply({ content: `❌ Ошибка: ${error.message || 'Проверьте права бота!'}` });
    }
  },
};
