// Arena progression + visual themes for the battlefield renderer.
(function (RR) {
  'use strict';
  const ARENAS = [
    { id: 0, name: 'Meadowgate', trophies: 0, desc: 'Rolling green fields where every champion begins.',
      theme: { grassA: '#7cc84a', grassB: '#71bd42', grassEdge: '#4f9a2c', path: '#d9b77a', pathEdge: '#b08d55',
        water: '#3fa9e8', waterDeep: '#2a7fc4', bank: '#8a6a3f', bridge: '#a8733e', trees: ['#3f8f2a', '#4ea535', '#2f7a22'],
        deco: 'meadow', sky: ['#7ed0ff', '#c8f0ff'], border: '#5a8f3a', flower: ['#ff6b8b', '#ffd23f', '#ffffff'] }, ai: 0 },
    { id: 1, name: 'Whisperwood', trophies: 300, desc: 'An ancient forest humming with gremlin mischief.',
      theme: { grassA: '#5fae4a', grassB: '#54a141', grassEdge: '#36782a', path: '#b99a6a', pathEdge: '#8a6c42',
        water: '#3a9ec0', waterDeep: '#246d8e', bank: '#5f4a2c', bridge: '#8b5a2b', trees: ['#2c6e2a', '#367d2e', '#1f5a22'],
        deco: 'forest', sky: ['#5fb48a', '#b8e6c0'], border: '#2e5f22', flower: ['#c38bff', '#ffe066', '#ff9f43'] }, ai: 1 },
    { id: 2, name: 'Frostpeak Pass', trophies: 700, desc: 'A frozen mountain pass where only the hardy survive.',
      theme: { grassA: '#e6f1fa', grassB: '#d6e7f4', grassEdge: '#a9c4dc', path: '#b8c6d4', pathEdge: '#8597aa',
        water: '#7fd3f5', waterDeep: '#4aa6d6', bank: '#7a8ea3', bridge: '#8a6a4f', trees: ['#2f6b5a', '#3b7f6a', '#285a4c'],
        deco: 'snow', sky: ['#9fd4ff', '#eef8ff'], border: '#9ab4cc', flower: ['#ffffff', '#cfe9ff', '#9fd4ff'] }, ai: 2 },
    { id: 3, name: 'Ember Canyon', trophies: 1100, desc: 'Molten rivers carve through scorched red rock.',
      theme: { grassA: '#c98a52', grassB: '#bd7f49', grassEdge: '#8a5530', path: '#7d5a45', pathEdge: '#5c3f2f',
        water: '#ff7a1a', waterDeep: '#d9420b', bank: '#4a2c20', bridge: '#5a3a28', trees: ['#6b3a22', '#7d4a2a', '#5a2f1c'],
        deco: 'canyon', sky: ['#ff9a5a', '#ffd9a0'], border: '#6b3f25', flower: ['#ffb02e', '#ff5e2e', '#ffe08a'], lava: true }, ai: 3 },
    { id: 4, name: 'Skyreach Citadel', trophies: 1600, desc: 'Floating isles above the clouds, guarded by storm mages.',
      theme: { grassA: '#8fd0a8', grassB: '#84c69d', grassEdge: '#5c9f7a', path: '#e5dcc8', pathEdge: '#b6a98c',
        water: '#cfe6ff', waterDeep: '#9fbfe8', bank: '#8a9ab8', bridge: '#c9b48a', trees: ['#4e9f7a', '#5fb48a', '#3f8a68'],
        deco: 'sky', sky: ['#a6b8ff', '#f0e8ff'], border: '#7a86b8', flower: ['#ffd1f0', '#d1e0ff', '#ffffff'], clouds: true }, ai: 4 },
    { id: 5, name: 'Crown Summit', trophies: 2200, desc: 'The golden throne-arena of legends. Only the best reach it.',
      theme: { grassA: '#9acb4f', grassB: '#8fbf47', grassEdge: '#5f8f2c', path: '#e8c873', pathEdge: '#b8953f',
        water: '#46c4d8', waterDeep: '#2a8fb0', bank: '#8c7240', bridge: '#d4a43a', trees: ['#467f2a', '#558f32', '#3a6e24'],
        deco: 'royal', sky: ['#ffd36b', '#fff4cc'], border: '#b8953f', flower: ['#ffd23f', '#ff6b8b', '#b98bff'] }, ai: 5 },
  ];

  RR.Arenas = {
    list: ARENAS,
    forTrophies(t) {
      let a = ARENAS[0];
      for (const ar of ARENAS) if (t >= ar.trophies) a = ar;
      return a;
    },
    next(t) {
      return ARENAS.find((a) => a.trophies > t) || null;
    },
  };
})(window.RR);
