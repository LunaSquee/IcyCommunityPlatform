// Generate a random int betweem two ints
function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Generate random string of characters
function uid (len) {
  let buf = ''
  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let charlen = chars.length

  for (var i = 0; i < len; ++i) {
    buf += chars[getRandomInt(0, charlen - 1)]
  }

  return buf
}

module.exports = uid
