import express from 'express'

import user from '../api/users'
import forum from '../api/forums'
import stream from '../api/stream'

import runtime from '../runtime'
import {wrapper} from './routeutils'

const router = express.Router()

// User data which is safe to show to the public
let safeUserData = {
  id: null,
  username: null,
  display_name: null,
  avatar_file: null,
  signature: null,
  admin: null,
  user_title: null,
  last_active: null,
  online: null,
  profile_slug: null,
  content: null
}

router.get('/user/:id', wrapper(async (req, res) => {
  let uid = parseInt(req.params.id)
  if (isNaN(uid)) {
    return res.jsonp({error: 'Invalid ID'})
  }

  let userData = await user.get(uid)
  if (!userData) {
    return res.jsonp({error: 'No such user.'})
  }

  let profile = await user.getPublicProfile(userData, true)

  let unfiltered = Object.assign(userData, profile)
  let data = {}

  for (let i in unfiltered) {
    if (safeUserData[i] !== undefined) {
      data[i] = unfiltered[i]
    }
  }

  res.jsonp(data)
}))

router.get('/user/posts/:id', wrapper(async (req, res) => {
  let uid = parseInt(req.params.id)
  if (isNaN(uid)) {
    return res.jsonp({error: 'Invalid ID'})
  }

  let page = req.query.page || 1
  if (typeof page === 'string') {
    page = parseInt(page)
    if (isNaN(page)) {
      page = 1
    }
  }

  let result = await forum.getPostsByUser(uid, page)
  if (!result) {
    return res.jsonp({error: true, text: 'Invalid ID'})
  }

  res.jsonp(result)
}))

router.get('/user/topics/:id', wrapper(async (req, res) => {
  let uid = parseInt(req.params.id)
  if (isNaN(uid)) {
    return res.jsonp({error: 'Invalid ID'})
  }

  let page = req.query.page || 1
  if (typeof page === 'string') {
    page = parseInt(page)
    if (isNaN(page)) {
      page = 1
    }
  }

  let result = await forum.getTopicsByUser(uid, page)
  if (!result) {
    return res.jsonp({error: true, text: 'Invalid ID'})
  }

  res.jsonp(result)
}))

router.post('/forum/create', wrapper(async (req, res) => {
  if (!req.session.user) {
    return res.jsonp({success: false, error: 'Login required.'})
  }

  if (req.body.csrf !== req.session.csrf) {
    return res.jsonp({success: false, error: 'Invalid CSRF Token.'})
  }

  if (!req.body.description || !req.body.title) {
    return res.jsonp({success: false, error: 'Required fields missing.'})
  }

  res.jsonp(await forum.addForum(req.body.title, req.body.description, req.session.user))
}))

router.post('/category/create/:id', wrapper(async (req, res) => {
  let forumid = parseInt(req.params.id)
  if (isNaN(forumid)) {
    return res.jsonp({success: false, error: 'Invalid id.'})
  }
  if (!req.session.user) {
    return res.jsonp({success: false, error: 'Login required.'})
  }

  if (req.body.csrf !== req.session.csrf) {
    return res.jsonp({success: false, error: 'Invalid CSRF Token.'})
  }

  if (!req.body.description || !req.body.title) {
    return res.jsonp({success: false, error: 'Required fields missing.'})
  }

  res.jsonp(await forum.addCategory(forumid, req.body.title, req.body.description, req.query.parent, req.session.user))
}))

module.exports = router
