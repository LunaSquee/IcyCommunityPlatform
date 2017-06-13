const bcrypt = require('bcryptjs')

function hashPassword (password, rounds) {
  const salt = bcrypt.genSaltSync(parseInt(rounds, 10))
  const hash = bcrypt.hashSync(password, salt)

  return hash
}

function comparePassword (password, hash) {
  const evalu = bcrypt.compareSync(password, hash)

  return evalu
}

function done (data) {
  process.send(data)
  setTimeout(() => {
    process.exit(0)
  }, 500)
}

process.once('message', (msg) => {
  msg = msg.toString()
  let param
  let res
  if (msg.indexOf('hash') === 0) {
    param = JSON.parse(msg.substring(5))
    res = hashPassword(param.password, 12)
    done(res)
  } else if (msg.indexOf('compare') === 0) {
    param = JSON.parse(msg.substring(8))
    res = comparePassword(param.password, param.hash)
    done(res)
  } else {
    done(null)
  }
})
