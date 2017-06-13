
module.exports = {
  wrapper: fn => (...args) => fn(...args).catch(args[2]),
  sendResponse: (req, res, message, url = '/') => {
    if (req.query.json != null) {
      return res.jsonp(message)
    }

    if (message) req.flash('message', message)
    res.redirect(url)
  }
}
