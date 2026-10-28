// =============================================================
// messages.js — The funny lines on the game-over screen.
// Add as many as you like! One is picked at random.
// =============================================================

OMJ.MESSAGES = {
  // Picked by final score: the first tier whose `below` is higher than the score.
  byScore: [
    { below: 25, lines: [
      'That was... technically a jump.',
      'Speedrun to failure: complete!',
      'Gravity says hi.',
      'Bold strategy. Let\'s see if it pays off. (It didn\'t.)',
    ] },
    { below: 100, lines: [
      'Not bad... for a warm-up.',
      'Legs: working. Timing: pending.',
      'Your ancestors are mildly impressed.',
      'The obstacles barely noticed you. Barely.',
    ] },
    { below: 250, lines: [
      'Ooh, look at you go!',
      'Respectable. The crates are getting nervous.',
      'You\'re getting the hang of this!',
      'Your thumbs are warming up.',
    ] },
    { below: 500, lines: [
      'Okay, show-off.',
      'The spikes are starting to fear you.',
      'That\'s some serious hop.',
      'Your knees deserve a vacation.',
    ] },
    { below: 1000, lines: [
      'Jump legend in training.',
      'Are your shoes made of springs?',
      'The leaderboard trembles. (There is no leaderboard.)',
    ] },
    { below: Infinity, lines: [
      'Are you even human?!',
      'The obstacles have filed a formal complaint.',
      'Certified Jump Wizard.',
      'Please go outside. You\'ve earned it.',
    ] },
  ],
};

OMJ.pickMessage = function (score) {
  const tiers = OMJ.MESSAGES.byScore;
  for (let i = 0; i < tiers.length; i++) {
    if (score < tiers[i].below) {
      const lines = tiers[i].lines;
      return lines[Math.floor(Math.random() * lines.length)];
    }
  }
  return '';
};

OMJ.pickFrom = function (list) {
  return list[Math.floor(Math.random() * list.length)];
};
