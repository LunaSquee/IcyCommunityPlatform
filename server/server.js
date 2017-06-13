import express from 'express'
import session from 'express-session'
import bodyParser from 'body-parser'
import connectRedis from 'connect-redis'
import path from 'path'
import ejs from 'ejs'

import fs from 'fs'

import config from '../utility/config.js'
import ipvalid from '../utility/ipValidity.js'
import flash from '../utility/flash.js'

import routes from './routes'
import runtime from './runtime'

let app = express()
let RedisStore = connectRedis(session)

const layoutPath = path.join(__dirname, '../layout')

app.enable('trust proxy', 1)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(ipvalid)
app.use(flash())

app.disable('x-powered-by')

app.use(session({
  key: config.server.session_key,
  secret: config.server.session_secret,
  store: new RedisStore(config.redis),
  resave: false,
  saveUninitialized: true
}))

module.exports = (args) => {
  runtime.load()

  let viewsPath = path.join(layoutPath, runtime.get('layout'))

  if (!fs.existsSync(viewsPath)) {
    throw new Error('Invalid Runtime configuration: No such layout')
  }

  app.set('view options', {layout: false})
  app.engine('html', ejs.renderFile)
  app.set('view engine', 'html')
  app.set('views', viewsPath)

  let staticAge = 7 * 24 * 60 * 60 * 1000
  if (args.dev) {
    staticAge = 1000
  }

  app.use('/css', express.static(path.join(viewsPath, 'css'), { maxAge: staticAge }))
  app.use('/js', express.static(path.join(viewsPath, 'js'), { maxAge: staticAge }))
  app.use('/static', express.static(path.join(viewsPath, 'static'), { maxAge: staticAge }))

  app.use(routes)

  app.listen(args.port, () => {
    console.log('Listening on 0.0.0.0:' + args.port)
  })
}
