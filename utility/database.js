const path = require('path')
const knex = require('knex')
const objection = require('objection')
const knexfile = require(path.join(__dirname, '../knexfile'))

let knexDB = knex(knexfile)
let objectionModel = objection.Model

objectionModel.knex(knexDB)

module.exports = {
  knex: knexDB,
  Model: objectionModel,
  destroy: knex.destroy
}
