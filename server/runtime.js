/**
 * Used to store variables about this system instance
 * Includes: Layout, file paths, admin structs and modules
 */

import path from 'path'
import config from '../utility/config'
import fs from 'fs'

const runtimePath = path.join(__dirname, '..', config.server.runtime)

let runtime = {
  layout: 'default',
  site: {
    title: 'Test Forum',
    description: 'A test community',
    tags: ['community'],
    address: 'http://localhost:8665'
  },
  activation_email: '%layout%/emails/activate.html',
  cssSheets: {
    all: null,
    forum: null,
    blog: null,
    user: null,
    pms: null
  },
  userTags: {
    'default': {
      name: 'Snowflake',
      image: null,
      color: '#8e8e8e'
    }
  },
  postsPerPage: 5,
  topicsPerPage: 15
}

function loadReady () {
  let exists = fs.existsSync(runtimePath)
  if (exists) {
    try {
      let data = fs.readFileSync(runtimePath, {encoding: 'utf8'})
      data = JSON.parse(data)

      for (let i in data) {
        if (runtime[i] != null) {
          runtime[i] = data[i]
        }
      }
    } catch (e) {
      console.error('Failed to load runtime variables!')
      console.error(e)
    }
  } else {
    resave()
  }
}

function resave () {
  try {
    fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, '  '))
  } catch (e) {
    console.error('Failed to save runtime variables!')
    console.error(e)
  }
}

function getVariable (v) {
  if (!v) return runtime
  let dataArr = runtime

  if (v.indexOf('.') !== -1) {
    let datPath = v.split('.')
    for (let i in datPath) {
      let point = datPath[i]
      let at = dataArr[point]
      if (!at) {
        dataArr = null
        break
      } else {
        dataArr = at
      }
    }
  } else {
    dataArr = runtime[v]
  }

  if (dataArr && typeof dataArr === 'string' && dataArr.indexOf('%layout%')) {
    dataArr.replace('%layout%', runtime['layout'])
  }

  return dataArr
}

function saveVariable (v, d) {
  runtime[v] = d
  return d
}

function parsedVariable (v, data) {
  let varib = getVariable(v)
  if (!varib) return null

  for (let i in data) {
    varib = varib.replace('%' + i + '%', data[i])
  }

  return varib
}

module.exports = {
  load: loadReady,
  save: resave,
  get: getVariable,
  getData: parsedVariable,
  set: saveVariable
}
