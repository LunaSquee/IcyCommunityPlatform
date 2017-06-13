import express from 'express'
import path from 'path'

import hash from '../../utility/hash'

import stream from '../api/stream'

const router = express.Router()

router.use((req, res, next) => {
  if (!req.session.csrf) {
    req.session.csrf = hash(16)
  }

  if (req.session.user) {
    stream.emit('user:activity', {
      id: req.session.user.id
    })
  }

  next()
})

let indexRoute = require(path.join(__dirname, 'site.js'))
let apiRoute = require(path.join(__dirname, 'api.js'))
let adminRoute = require(path.join(__dirname, 'admin.js'))

router.use('/api', apiRoute)
router.use('/admin', adminRoute)
router.use('/', indexRoute)

router.use((err, req, res, next) => {
  console.error(err)
  next()
})

module.exports = router
