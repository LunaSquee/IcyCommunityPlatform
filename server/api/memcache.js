
class Cache {
  constructor (maxLifetime) {
    this.life = maxLifetime
    this.storage = {}
  }

  get (variable) {
    if (this.storage[variable]) {
      if (this.storage[variable].time < Date.now() - this.life) {
        delete this.storage[variable]
        return null
      }
      return this.storage[variable].data
    }
    return null
  }

  delete (variable) {
    if (this.storage[variable]) delete this.storage[variable]
    return true
  }

  clear () {
    this.storage = {}
  }

  store (variable, data) {
    this.storage[variable] = {
      time: Date.now(),
      data: data
    }
  }
}

module.exports = Cache
