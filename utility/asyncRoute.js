function asyncRoute (func) {
  return (req, res, next) => {
    func(req, res, next).then(() => {
      if (!res.headersSent) {
        next()
      }
    }, (error) => {
      console.error(error)
      if (!res.headersSent) {
        res.status(500).send(error)
      }
    })
  }
}

module.exports = asyncRoute
