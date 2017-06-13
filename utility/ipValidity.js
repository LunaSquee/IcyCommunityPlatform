
module.exports = function (req, res, next) {
  let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress

  if (ipAddr.indexOf('::ffff:') !== -1) {
    ipAddr = ipAddr.replace('::ffff:', '')
  }

  req.realIP = ipAddr

  next()
}
