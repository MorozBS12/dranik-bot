const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

function initDB() {
  if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ players: {}, testers: {}, matches: [] }, null, 2));
  }
  console.log('✅ База данных инициализирована');
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { players: {}, testers: {}, matches: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function upsertPlayer(nickname, tier) {
  const db = readDB();
  db.players[nickname] = { nickname, tier, updated_at: new Date().toISOString() };
  writeDB(db);
}

function getPlayer(nickname) {
  return readDB().players[nickname] || null;
}

function incrementTester(discordId, nickname) {
  const db = readDB();
  if (!db.testers[discordId]) {
    db.testers[discordId] = { discord_id: discordId, nickname, tests_count: 0 };
  }
  db.testers[discordId].tests_count += 1;
  db.testers[discordId].nickname = nickname;
  db.testers[discordId].updated_at = new Date().toISOString();
  writeDB(db);
}

function getTopTesters(limit = 10) {
  const db = readDB();
  return Object.values(db.testers)
    .sort((a, b) => b.tests_count - a.tests_count)
    .slice(0, limit);
}

function addMatch(player, tester, tier, score) {
  const db = readDB();
  db.matches.push({ player, tester, tier, score, created_at: new Date().toISOString() });
  writeDB(db);
}

module.exports = { initDB, upsertPlayer, getPlayer, incrementTester, getTopTesters, addMatch };
