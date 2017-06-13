const util = require('util')
const format = util.format

/*
* Clean version of https://github.com/jaredhanson/connect-flash
* Included here to avoid includng ridiculously small modules
*/

module.exports = function (options) {
  options = options || {}
  let safe = (options.unsafe === undefined) ? true : !options.unsafe

  return function (req, res, next) {
    if (req.flash && safe) { return next() }
    req.flash = _flash
    next()
  }
}

function _flash (type, msg) {
  if (this.session === undefined) throw Error('req.flash() requires sessions')

  let msgs = this.session.flash = this.session.flash || {}
  if (type && msg) {
    if (arguments.length > 2 && format) {
      let args = Array.prototype.slice.call(arguments, 1)
      msg = format.apply(undefined, args)
    } else if (Array.isArray(msg)) {
      msg.forEach((val) => {
        (msgs[type] = msgs[type] || []).push(val)
      })
      return msgs[type].length
    }
    return (msgs[type] = msgs[type] || []).push(msg)
  } else if (type) {
    let arr = msgs[type]
    delete msgs[type]
    return arr || []
  } else {
    this.session.flash = {}
    return msgs
  }
}
