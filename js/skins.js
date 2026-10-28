// =============================================================
// skins.js — Unlockable character colors.
// A skin unlocks once your personal BEST reaches `unlockAt`.
// To add a skin, copy one entry and change its colors.
//   body / shade / light = the character's body colors
//   scarf                = the flappy scarf color
//   rainbow: true        = scarf cycles through colors
// =============================================================

OMJ.SKINS = [
  { id: 'classic', name: 'Classic', unlockAt: 0,    body: '#ff7a3d', shade: '#c2412b', light: '#ffb36b', scarf: '#3b8bff' },
  { id: 'minty',   name: 'Minty',   unlockAt: 100,  body: '#5fe0a0', shade: '#2a9d6f', light: '#b5ffd8', scarf: '#ff5c8a' },
  { id: 'berry',   name: 'Berry',   unlockAt: 250,  body: '#b45cff', shade: '#7a2fc2', light: '#dcb0ff', scarf: '#ffd23f' },
  { id: 'ghost',   name: 'Ghost',   unlockAt: 500,  body: '#e8f0ff', shade: '#a8b4d0', light: '#ffffff', scarf: '#7bd6ff' },
  { id: 'ninja',   name: 'Ninja',   unlockAt: 750,  body: '#3a3a4e', shade: '#22222e', light: '#5a5a74', scarf: '#ff3b3b' },
  { id: 'golden',  name: 'Golden',  unlockAt: 1000, body: '#ffd23f', shade: '#c99a10', light: '#fff2a8', scarf: '#ffffff' },
  { id: 'cosmic',  name: 'Cosmic',  unlockAt: 2000, body: '#2b1b5c', shade: '#170e36', light: '#5b3fb0', scarf: '#ff4fd8', rainbow: true },
];

OMJ.getSkin = function (id) {
  for (let i = 0; i < OMJ.SKINS.length; i++) {
    if (OMJ.SKINS[i].id === id) return OMJ.SKINS[i];
  }
  return OMJ.SKINS[0];
};

OMJ.isSkinUnlocked = function (skin, best) {
  return best >= skin.unlockAt;
};
