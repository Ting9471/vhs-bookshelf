// Original film data and sprite rectangles from the supplied replication specification.
const sheet = (filename, width, height) => ({ url: new URL(`./assets/${filename}`, import.meta.url).href, width, height });
export const sheets = {
  covers: sheet('covers.webp', 1744, 2336),
  spines: sheet('spines.webp', 2688, 1152),
  fix: sheet('fix.webp', 1520, 2688),
  fix2: sheet('fix2.webp', 1520, 2688),
  alice: sheet('alice-cover.jpg', 960, 1486),
};
export const films = [
  { id: 'valley', title: 'The Silent Valley', romaji: 'SHIZUKANA TANI', kanji: '静かな谷', year: 1958, genre: 'Drama', minutes: 104, synopsis: 'A schoolteacher returns to the mountain village that exiled her father, and finds the valley has kept every one of its secrets.', spine: ['spines', 266, 31, 189, 1089], cover: ['covers', 497, 72, 344, 659] },
  { id: 'bluehour', title: 'The Blue Hour', romaji: 'AO NO TOKI', kanji: '青の刻', year: 1962, genre: 'Romance', minutes: 97, synopsis: 'Over one long evening in a harbour town, a widow and a stranger trade small lies until the light runs out.', spine: ['spines', 492, 31, 189, 1089], cover: ['covers', 914, 72, 342, 659] },
  { id: 'river', title: 'River of Salt', romaji: 'SHIO NO KAWA', kanji: '塩の川', year: 1964, genre: 'Drama', minutes: 121, synopsis: 'Two brothers drag a salt barge downriver to a city that no longer wants anything they carry.', spine: ['fix', 197, 54, 324, 2566], cover: ['covers', 1332, 72, 344, 659] },
  { id: 'summer', title: 'The Last Summer', romaji: 'SAIGO NO NATSU', kanji: '最後の夏', year: 1966, genre: 'Drama', minutes: 109, synopsis: 'The summer before the dam floods their village, three friends set fire to everything they cannot take with them.', spine: ['spines', 937, 31, 188, 1089], cover: ['covers', 74, 813, 344, 676] },
  { id: 'green', title: 'The Green Road', romaji: 'MIDORI NO MICHI', kanji: '緑の道', year: 1969, genre: 'Mystery', minutes: 101, synopsis: 'A surveyor mapping a forest road keeps finding the same footprints, always one day ahead of him.', spine: ['spines', 1157, 31, 185, 1090], cover: ['covers', 497, 815, 344, 674] },
  {
    id: 'alice', type: 'book', title: 'Alice’s Adventures in Wonderland', displayTitle: '爱丽丝梦游仙境',
    author: 'Lewis Carroll', illustrator: 'John Tenniel', year: 1865, genre: 'Fantasy', language: 'zh',
    synopsis: '爱丽丝追随一只揣着怀表的白兔，跌进了一个规则随时改变的世界。在茶会、谜语与荒诞的审判之间，好奇心带她一路前行。',
    cover: ['alice', 0, 0, 960, 1486], coverRatio: 960 / 1486,
    spineTitle: 'ALICE’S ADVENTURES IN WONDERLAND',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alice%27s_Adventures_in_Wonderland_cover_(1865).jpg',
    sourceNote: '封面：1865 年版 · Wikimedia Commons 标注为公有领域。书脊为本站重新排版，并非原版扫描。',
  },
  { id: 'observer', title: 'The Observer', romaji: 'KANSATSUSHA', kanji: '観察者', year: 1973, genre: 'Thriller', minutes: 96, synopsis: 'A night watchman begins to suspect that the building he guards has started watching him back.', spine: ['fix2', 371, 15, 349, 2655], cover: ['covers', 915, 815, 342, 675] },
  { id: 'birds', title: 'The Fallen Birds', romaji: 'OCHITA TORI', kanji: '落ちた鳥', year: 1975, genre: 'Drama', minutes: 118, synopsis: "When the birds stop singing over a frontier town, the mayor's daughter is the only one who goes looking for the reason.", spine: ['spines', 1573, 31, 183, 1089], cover: ['covers', 1331, 815, 345, 675] },
  { id: 'storm', title: 'Light in the Storm', romaji: 'ARASHI NO HI', kanji: '嵐の灯', year: 1978, genre: 'Drama', minutes: 127, synopsis: 'A lighthouse keeper and his son wait out a three-day storm with a shipwrecked sailor who will not give his name.', spine: ['fix2', 808, 15, 347, 2656], cover: ['covers', 74, 1571, 345, 681] },
  { id: 'tide', title: 'The Long Tide', romaji: 'NAGAI SHIO', kanji: '長い潮', year: 1981, genre: 'Drama', minutes: 99, synopsis: "A fisherman's wife counts the tides on the harbour wall while her husband's boat fails to come home.", spine: ['spines', 2012, 31, 188, 1089], cover: ['covers', 496, 1577, 343, 678] },
  { id: 'war', title: 'A Quiet War', romaji: 'SHIZUKANA SENSO', kanji: '静かな戦争', year: 1985, genre: 'Comedy', minutes: 103, synopsis: 'Two neighbours fight a silent war over a garden wall for thirty years, and neither will say how it began.', spine: ['spines', 2236, 31, 189, 1089], cover: ['covers', 913, 1579, 343, 676] },
  { id: 'door', title: 'Red Door', romaji: 'AKAI TOBIRA', kanji: '赤い扉', year: 1989, genre: 'Thriller', minutes: 114, synopsis: 'A projectionist follows a reel of unknown film through the corridors of a cinema on its final night.', spine: ['spines', 2462, 31, 188, 1089], cover: ['covers', 1331, 1579, 344, 677] },
];
export const modulo = (value, length) => ((value % length) + length) % length;
export const relative = (value, position, length = 36) => modulo(value - position + length / 2, length) - length / 2;
export const smoothstep = (value) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
export function shelfX(r, ws, d, gap) {
  const step = Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) / 2;
  return r * (ws + gap) + (d - ws + 1.6 * gap) * step;
}
export function applyCrop(element, crop) {
  const [id, x, y, w, h] = crop;
  const source = sheets[id];
  element.style.backgroundImage = `url("${source.url}")`;
  element.style.backgroundSize = `${source.width / w * 100}% ${source.height / h * 100}%`;
  const positionX = source.width === w ? 0 : x / (source.width - w) * 100;
  const positionY = source.height === h ? 0 : y / (source.height - h) * 100;
  element.style.backgroundPosition = `${positionX}% ${positionY}%`;
}
