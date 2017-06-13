#!/usr/bin/env node
const path = require('path')

if (process.argv.indexOf('-d') === -1 && process.argv.indexOf('--development') === -1) {
  process.env.NODE_ENV = 'production'
}

require('babel-core/register')({
  plugins: [
    'transform-es2015-modules-commonjs',
    'syntax-async-functions',
    'transform-async-to-generator'
  ]
})

require(path.join(__dirname, 'server'))
