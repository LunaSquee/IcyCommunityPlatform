module.exports = (text) => {
  return text.replace(/\W+/g, '-').toLowerCase()
}
