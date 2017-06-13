'use strict'
import config from '../utility/config.js'
import cluster from 'cluster'
import path from 'path'
import pkg from '../package.json'

const cpuCount = require('os').cpus().length
const workers = []

const args = {
  dev: process.env.NODE_ENV !== 'production',
  port: config.server.port
}

async function initialize () {
  try {
    const knex = require('knex')(require('../knexfile'))
    console.log('Initializing database...')
    await knex.migrate.latest()
    console.log('Database initialized')
    await knex.destroy()
  } catch (err) {
    console.error('Database error:', err)
  }

  let workerCount = config.server.workers === 0 ? cpuCount : config.server.workers
  // logger.info('master', 'Spinning up ' + workerCount + ' worker process' + (workerCount !== 1 ? 'es' : ''))
  console.log('Spinning up ' + workerCount + ' worker process' + (workerCount !== 1 ? 'es' : ''))

  for (let i = 0; i < workerCount; i++) {
    spawnWorker()
  }
}

function spawnWorker (oldWorker) {
  const w = cluster.fork()
  w.process.stdout.on('data', (data) => {
    console.log(w.process.pid, data.toString().trim())
  })
  w.process.stderr.on('data', (data) => {
    console.log(w.process.pid, data.toString().trim())
  })
  args.verbose && console.log('Starting worker process ' + w.process.pid + '...')

  w.on('message', (message) => {
    if (message === 'started') {
      workers.push(w)
      args.verbose && console.log('Started worker process ' + w.process.pid)
      if (oldWorker) {
        args.verbose && console.log('Stopping worker process ' + oldWorker.process.pid)
        oldWorker.send('stop')
      }
    } else {
      console.log(w.process.pid)
      console.log(message)
    }
  })

  args.id = w.process.pid

  w.send(args)
  return w
}

console.log('Initializing IcyCommunityPlatform v' + pkg.version)

cluster.setupMaster({
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  exec: path.join(__dirname, './worker.js')
})

cluster.on('exit', (worker, code, signal) => {
  let extra = ((code || '') + ' ' + (signal || '')).trim()

  console.error('Worker process ' + worker.process.pid + ' exited ' + (extra ? '(' + extra + ')' : ''))

  let index = workers.indexOf(worker)

  if (index !== -1) workers.splice(index, 1)
  if (code === 0) return

  setTimeout(() => {
    spawnWorker()
  }, 10 * 1000)
})

initialize()
