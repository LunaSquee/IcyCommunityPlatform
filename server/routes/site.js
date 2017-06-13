import express from 'express'

import user from '../api/users'
import forum from '../api/forums'
import stream from '../api/stream'

import runtime from '../runtime'
import {wrapper, sendResponse} from './routeutils'

const router = express.Router()

router.use(wrapper(async (req, res, next) => {
  let renderVars = {
    user: req.session.user,
    csrf: req.session.csrf
  }

  let site = runtime.get('site')

  // Give a sense of site
  renderVars['site'] = site
  renderVars['metadata'] = {
    description: site.description,
    keywords: site.tags.join(', ')
  }

  let messages = req.flash('message')
  if (!messages || !messages.length) {
    messages = {}
  } else {
    messages = messages[0]
  }

  renderVars['message'] = messages
  req.renderVars = renderVars

  if (req.session.updatequeue && req.session.updatequeue < Date.now()) {
    if (!req.session.user) return next()

    let udatanew = await user.get(req.session.user)
    if (!udatanew) return res.redirect('/logout')

    req.session.user = {
      id: udatanew.id,
      username: udatanew.username,
      display_name: udatanew.display_name,
      avatar_file: udatanew.avatar_file,
      admin: udatanew.admin,
      identifier: udatanew.identifier
    }

    req.session.updatequeue = Date.now() + 3600 * 1000
  }

  next()
}))

router.get('/', wrapper(async (req, res) => {
  let forums = await forum.getListForums(true, req.session.user)
  req.renderVars['forums'] = forums

  res.render('index', req.renderVars)
}))

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/')
  }

  req.renderVars['formkeep'] = {}
  res.render('login', req.renderVars)
})

router.post('/login', wrapper(async (req, res) => {
  let username = req.body.username
  let password = req.body.password

  if (!req.body.csrf || req.body.csrf !== req.session.csrf) {
    req.flash('message', {error: true, text: 'Invalid CSRF Token!\nTry reloading the page'})
    return res.redirect('/login')
  }

  if (!username && !password) {
    req.flash('message', {error: true, text: 'Please provide username and password'})
    return res.redirect('/login')
  }

  let loginModel = {
    password: password,
    ip: req.realIP
  }

  if (username.indexOf('@') !== -1) {
    loginModel.email = username
  } else {
    loginModel.username = username
  }

  let loginAttempt = await user.shouldLoginPermit(loginModel)

  if (!loginAttempt) {
    return sendResponse(req, res, {error: true, text: 'Something went wrong!'}, '/login')
  }

  if (!loginAttempt.should) {
    return sendResponse(req, res, {error: true, text: loginAttempt.reason}, '/login')
  }

  if (!loginAttempt.user) {
    return sendResponse(req, res, {error: true, text: 'Something went wrong!'}, '/login')
  }

  let userdata = loginAttempt.user

  req.session.user = {
    id: userdata.id,
    username: userdata.username,
    display_name: userdata.display_name,
    avatar_file: userdata.avatar_file,
    admin: userdata.admin,
    identifier: userdata.identifier
  }

  req.session.updatequeue = Date.now() + 3600 * 1000 // 1 hour update interval

  await user.loginSuccess(userdata, req.realIP, req.headers['user-agent'])

  sendResponse(req, res, {error: false, text: 'Logged in'}, req.query.returnUrl || '/')
}))

router.get('/logout', (req, res) => {
  if (req.session.user) {
    stream.emit('user:logout', {
      id: req.session.user.id
    })
    delete req.session.user

    if (req.session.updatequeue) {
      delete req.session.updatequeue
    }
  }

  res.redirect('/')
})

router.get('/forum', (req, res) => {
  res.redirect('/')
})

router.get('/register', (req, res) => {
  if (req.session.user) {
    res.redirect('/')
  }

  let dataSave = req.flash('formkeep')
  if (dataSave.length) {
    dataSave = dataSave[0]
  } else {
    dataSave = {}
  }

  req.renderVars['formkeep'] = dataSave
  res.render('login', req.renderVars)
})

function formError (req, res, error, formData, path = '/register') {
  req.flash('formkeep', formData)
  sendResponse(req, res, {error: true, text: error}, path)
}

router.post('/register', wrapper(async (req, res) => {
  let fields = [
    'csrf',
    'username',
    'display_name',
    'email',
    'password',
    'password_repeat'
  ]

  let populated = {
    ip: req.realIP
  }

  for (let i in fields) {
    if (!req.body[fields[i]]) {
      return formError(req, res, 'Missing fields!', {})
    }
    populated[fields[i]] = req.body[fields[i]]
  }

  if (populated.csrf !== req.session.csrf) {
    return formError(req, res, 'Invalid CSRF Token!\nTry reloading the page', populated)
  }

  if (populated.password !== populated.password_repeat) {
    return formError(req, res, 'The passwords do not match!', populated)
  }

  let newUser = await user.createNewUser(populated)
  if (newUser.success === false) {
    return formError(req, res, newUser.message, populated)
  }

  sendResponse(req, res, {error: false, text: 'Account created successfully!'}, '/login')
}))

router.get('/forum/:id-*?', wrapper(async (req, res) => {
  let id = parseInt(req.params.id)

  if (isNaN(id)) {
    return res.redirect('/')
  }

  let page = req.query.page || 1
  if (typeof page === 'string') {
    page = parseInt(page)
    if (isNaN(page)) {
      page = 1
    }
  }

  let category = await forum.getTopicsInCategory(id, page, null, req.session.user)

  if (category.error != null) {
    return res.send(category.error)
  }

  let cdata = req.flash('contentdata')
  if (!cdata.length) {
    cdata = ''
  } else {
    cdata = cdata[0]
  }

  req.renderVars['contentdata'] = cdata
  req.renderVars['page'] = category

  res.render('topics', req.renderVars)
}))

router.post('/forum/:id-*?', wrapper(async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login')
  }

  if (isNaN(parseInt(req.params.id))) {
    return res.redirect('/forum')
  }

  let category = parseInt(req.params.id)
  let parsed = req._parsedUrl.pathname

  if (!req.body.title || !req.body.content) {
    return sendResponse(req, res, {error: true, text: 'Title and content mandatory!'}, parsed + '#showEditor')
  }

  let content = req.body.content

  if (!req.body.csrf || req.body.csrf !== req.session.csrf) {
    req.flash('contentdata', content)
    return sendResponse(req, res, {error: true, text: 'Invalid CSRF Token!\nTry reloading the page'}, parsed + '#showEditor')
  }

  let topic = await forum.createTopic(category, req.body.title, req.body.content, req.realIP, req.session.user)
  if (topic.success === false) {
    req.flash('contentdata', content)
    return sendResponse(req, res, {error: true, text: topic.error}, parsed + '#showEditor')
  }

  if (req.query.json != null) {
    return res.jsonp({error: false, topic: topic})
  }

  res.redirect('/forum/viewtopic/' + topic.topic.id + '-' + topic.topic.slug)
}))

router.get('/forum/viewtopic/:id-*?', wrapper(async (req, res) => {
  if (isNaN(parseInt(req.params.id))) {
    return res.redirect('/forum')
  }

  let find = req.query.findPost

  // If the query contains 'latest', go to the latest post
  if (req.query.latest != null) {
    let latestPost = await forum.getLatestPost(req.params.id)
    if (latestPost) {
      find = latestPost.id
    }
  }

  // Go to the post specified in query
  if (find != null && !isNaN(parseInt(find))) {
    let pageOf = await forum.getPostPage(parseInt(find))
    if (pageOf != null) {
      return res.redirect('?page=' + pageOf + '#post-' + find)
    }
  }

  // Get page
  let page = 1
  if (req.query.page) {
    page = parseInt(req.query.page)
    if (isNaN(page)) {
      page = 1
    }
  }

  // Get the topic
  let topic = await forum.getPostsInTopic(req.params.id, page, null, req.session.user, req.realIP)
  if (!topic.page) {
    req.flash('message', {error: true, text: topic.error})
    return res.redirect('/forum')
  }

  // Return any content that a POST error saved
  let cdata = req.flash('contentdata')
  if (!cdata.length) {
    cdata = ''
  } else {
    cdata = cdata[0]
  }

  req.renderVars['page'] = topic
  req.renderVars['contentdata'] = cdata
  res.render('viewtopic', req.renderVars)
}))

router.post('/forum/viewtopic/:id-*?', wrapper(async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login')
  }

  let parsed = req._parsedUrl.pathname
  let content = req.body.content

  if (isNaN(parseInt(req.params.id))) {
    return sendResponse(req, res, {error: true, text: 'No such forum'}, parsed + '#composer')
  }

  if (!req.body.content) {
    return sendResponse(req, res, {error: true, text: 'Content is required!'}, parsed + '#composer')
  }

  if (!req.body.csrf || req.body.csrf !== req.session.csrf) {
    req.flash('contentdata', content)
    return sendResponse(req, res, {error: true, text: 'Invalid CSRF Token!\nTry reloading the page'}, parsed + '#composer')
  }

  let poststatus = await forum.addReply(req.params.id, req.body.content, req.realIP, req.session.user)
  if (!poststatus.success) {
    req.flash('contentdata', content)
    return sendResponse(req, res, {error: true, text: poststatus.error}, parsed + '#composer')
  }

  if (req.query.json != null) {
    let postid = poststatus.post.id
    let pageOf = await forum.getPostPage(postid)

    if (pageOf != null) {
      return res.redirect('?page=' + pageOf + '#post-' + postid)
    }

    return res.jsonp({post: poststatus.post, page: pageOf})
  }

  res.redirect(parsed + '?findPost=' + poststatus.post.id)
}))

router.get('/forum/post/:id', wrapper(async (req, res) => {
  let post = parseInt(req.params.id)
  if (isNaN(post)) {
    return res.jsonp({error: true, text: 'Invalid id'})
  }

  let result = await forum.getPostByID(post)
  if (!result) {
    return res.jsonp({error: true, text: 'Invalid id'})
  }

  res.jsonp(result)
}))

router.post('/forum/post/:id', wrapper(async (req, res) => {
  let post = parseInt(req.params.id)
  if (isNaN(post)) {
    return res.jsonp({error: true, text: 'Invalid id'})
  }

  if (!req.session.user) {
    return res.jsonp({error: true, text: 'You need to be logged in to do that!'})
  }

  if (!req.body.csrf || req.body.csrf !== req.session.csrf) {
    return res.jsonp({error: true, text: 'Invalid CSRF Token! Reloading the page usually fixes this.'})
  }

  let content = req.body.content

  let result = await forum.editReply(post, content, req.realIP, req.session.user)
  if (result.success === false) {
    return res.jsonp({error: true, text: result.error})
  }

  res.jsonp(result)
}))

router.get('/test', wrapper(async (req, res) => {
  await forum.addForum('Test forum', 'forum for testing')
  await forum.addCategory(1, 'Test category', 'category for testing', null)
}))

module.exports = router
