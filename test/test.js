const assert = require('assert');
const { getRandomColor } = require('../extension/util');

for (let i = 0; i < 10; i++) {
  const color = getRandomColor();
  assert(/^#[0-9A-F]{6}$/i.test(color), `${color} is not a valid color`);
}

console.log('All tests passed');
