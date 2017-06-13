import cprog from 'child_process'
import path from 'path'

import db from '../../utility/database'
import config from '../../utility/config'
import slugify from '../../utility/slug'

import runtime from '../runtime'

import stream from './stream'
import Cache from './memcache'

const Model = db.Model

let groupMembershipCache = new Cache(1800000)

class User extends Model {
  static get tableName () {
    return 'users'
  }
/*
  static relationMappings () {
    return {
      posts: {
        relation: Model.HasManyRelation,
        modelClass: forums.Model.Post,
        join: {
          from: 'user.id',
          to: 'post.user_id'
        }
      },
      blogs: {
        relation: Model.HasManyRelation,
        modelClass: blogs.Model.Blog,
        join: {
          from: 'user.id',
          to: 'blog.user_id'
        }
      },
      blog_posts: {
        relation: Model.HasManyRelation,
        modelClass: blogs.Model.BlogPost,
        join: {
          from: 'user.id',
          to: 'blogpost.user_id'
        }
      }
    }
  }
  */
}

class Logins extends Model {
  static get tableName () {
    return 'logins'
  }
}

class Ban extends Model {
  static get tableName () {
    return 'bans'
  }
}

class Group extends Model {
  static get tableName () {
    return 'groups'
  }
}

class GroupMember extends Model {
  static get tableName () {
    return 'group_members'
  }
}

function validateEmail (email) {
  var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(email)
}

function bcryptTask (data) {
  return new Promise((resolve, reject) => {
    let proc = cprog.fork(path.join(__dirname, '../../utility', 'crypt.js'))
    let done = false
    proc.send(data.task + ' ' + JSON.stringify(data))
    proc.on('message', (chunk) => {
      if (!chunk) return reject(new Error('No response'))
      let line = chunk.toString().trim()
      done = true
      if (line === 'error') {
        return reject(new Error(line))
      }
      if (line === 'true' || line === 'false') {
        return resolve(line === 'true')
      }
      resolve(line)
    })
    proc.on('exit', () => {
      if (!done) {
        reject(new Error('No response'))
      }
    })
  })
}

const adminPerms = [
  'forum.create',
  'forum.modify',
  'topic.create',
  'topic.reply',
  'topic.modify.other',
  'topic.block',
  'forum.post.locked',
  'forum.post.blocked',
  'announcement.modify',
  'blog.create',
  'blog.modify.other',
  'post.seeip',
  'post.length.bypass',
  'webhook.create'
]

const API = {
  Model: {
    User: User
  },
  Password: {
    hash: async function (password) {
      return bcryptTask({task: 'hash', password: password})
    },
    compare: async function (password, hash) {
      return bcryptTask({task: 'compare', password: password, hash: hash})
    }
  },
  get: async function (identifier) {
    let userObj = null

    if (typeof identifier === 'object' && identifier.id != null && identifier.user_id == null) {
      userObj = await User.query().where('id', identifier.id)
    } else if (identifier.user_id != null) {
      userObj = await User.query().where('id', identifier.user_id)
    } else if (typeof identifier === 'string') {
      let type = 'username'

      if (identifier.indexOf('@') !== -1) {
        type = 'email'
      }

      userObj = await User.query().where(type, identifier)
    } else if (typeof identifier === 'number') {
      userObj = await User.query().where('id', identifier)
    }

    if (!userObj || !userObj.length) {
      return null
    }

    userObj = userObj[0]

    userObj.admin = userObj.admin === 1

    if (!userObj.avatar_file) {
      userObj.avatar_file = '/static/image/profile.png'
    }

    return userObj
  },
  ensureUserIsObject: async function (user) {
    if (!user.id) {
      user = await API.get(user)
    }

    return user
  },
  getLogins: async function (user) {
    user = await API.ensureUserIsObject(user)
    if (!user) return []

    let data = await Logins.query().where('user_id', user.id)

    return data
  },
  shouldLoginPermit: async function (req) {
    let user = await API.get(req.username || req.email)

    if (!user) return {should: false, reason: 'Invalid username or password'}

    let passwordCorrect = await API.Password.compare(req.password, user.password)

    if (!passwordCorrect) {
      return {should: false, reason: 'Invalid username or password', past: 'password'}
    }

    // TODO: TOTP tokens

    // Check 1: check banned user id
    let bans = await Ban.query().where('banned_id', user.id)
    if (bans.length) {
      for (let i in bans) {
        let ban = bans[i]
        if (new Date(ban.expires_at).getTime() > new Date().getTime()) {
          return {should: false, reason: 'You are banned!\rReason: ' + ban.reason}
        }
      }
    }

    // Check 2: check banned user ip
    bans = await Ban.query().where('ip_address', req.ip)
    if (bans.length) {
      for (let i in bans) {
        let ban = bans[i]
        if (new Date(ban.expires_at).getTime() > new Date().getTime()) {
          return {should: false, reason: 'You are banned!\rReason: ' + ban.reason}
        }
      }
    }

    user.identifier = user.id + '-' + slugify(user.display_name)

    return {should: true, user: user}
  },
  loginSuccess: async function (user, ipAddress, userAgent) {
    user = await User.query().patchAndFetchById(user.id, {ip_address: ipAddress})

    await Logins.query().insert({
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    })

    stream.emit('user:login', {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      ip_address: ipAddress,
      user_agent: userAgent
    })

    return user
  },
  createNewUser: async function (req) {
    if (!req.username.match(/^[a-zA-Z0-9_-]+$/) || req.username.length < 4 || req.username.length > 26) {
      return {success: false, message: 'Invalid username! Your username can only contain numbers 0-9, letters A-Z, _ and -\nand must be betweem 3 and 26 characters in length!'}
    }

    if (!req.password.length > 8) {
      return {success: false, message: 'Your password must be at least 8 characters long!'}
    }

    if (req.password.length > 32) {
      return {success: false, message: 'Your password is too long!'}
    }

    if (!validateEmail(req.email)) {
      return {success: false, message: 'Invalid email address!'}
    }

    let testUsername = await API.get(req.username)
    let testEmail = await API.get(req.email)

    if (testUsername || testEmail) {
      return {success: false, message: 'That ' + (testUsername != null ? 'username' : 'email') + ' is already registered!'}
    }

    let password = await API.Password.hash(req.password)

    let fields = {
      username: req.username,
      display_name: req.display_name,
      email: req.email,
      user_title: 'default',
      profile: JSON.stringify({
        content: '',
        color: null,
        background: null,
        links: []
      }),
      password: password,
      ip_address: req.ip,
      activated: true, // TODO: activation emails
      created_at: new Date()
    }

    let user = await User.query().insert(fields)

    let defaultGroup = await API.getGroup(1)
    if (!defaultGroup) {
      defaultGroup = await API.createGroup({
        user_id: 1,
        title: 'Default',
        removable: false,
        permission_list: {user_access: [], nodes: []},
        content: 'The default user group.',
        user_title: 'default'
      })

      console.log('Default group was created')
    }

    if (user.id === 1) {
      await User.query().patchAndFetchById(1, {admin: true})
    }

    await API.addUserToGroup(user, defaultGroup)

    stream.emit('user:new', {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email
    })

    return {success: true}
  },
  getPublicProfile: async function (user, profilePage) {
    user = await API.ensureUserIsObject(user)
    if (user === null) return {}

    let titles = runtime.get('userTags')
    let utitle = user.user_title

    if (titles[utitle]) {
      titles[utitle].type = utitle
      utitle = titles[utitle]
    } else {
      utitle = titles['default']
      utitle.type = 'default'
    }

    let minimal = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_file: user.avatar_file,
      signature: user.signature,
      admin: user.admin,
      user_title: utitle,
      profile_slug: user.id + '-' + slugify(user.display_name)
    }

    if (profilePage) {
      minimal['profile'] = JSON.parse(user.profile)
      /*
      let topics = await forums.Model.Post.query().where('user_id', user.id)
      let posts = await forums.Model.Post.query().where('user_id', user.id)
      let blog = await blogs.Model.Blog.query().where('user_id', user.id)

      minimal['count'] = {
        topics: topics.length,
        posts: posts.length,
        blogs: blog.length
      }
      */
    }

    return minimal
  },
  getGroup: async function (identifier) {
    let group = null

    if (identifier.id) {
      group = await Group.query().where('id', identifier.id)
    } else if (typeof identifier === 'number') {
      group = await Group.query().where('id', identifier)
    } else if (typeof identifier === 'string') {
      group = await Group.query().where('slug', identifier)
    }

    if (!group) return null
    if (group.length) return group[0]

    return null
  },
  createGroup: async function (group) {
    if (typeof group.permission_list === 'object') {
      group.permission_list = JSON.stringify(group.permission_list)
    }

    let data = Object.assign({
      created_at: new Date()
    }, group)
    data.slug = slugify(data.title)

    return Group.query().insert(data)
  },
  addUserToGroup: async function (user, group) {
    user = await API.ensureUserIsObject(user)

    if (!group.id) {
      group = await Group.query().where('id', group)
      if (!group.length) return
      group = group[0]
    }

    return GroupMember.query().insert({
      user_id: user.id,
      group_id: group.id,
      created_at: new Date()
    })
  },
  getGroups: async function (user) {
    if (!user) return []
    user = await API.ensureUserIsObject(user)
    let membership = groupMembershipCache.get('grps#' + user.id)

    if (!membership) {
      membership = await GroupMember.query().where('user_id', user.id)
      if (membership.length) {
        for (let i in membership) {
          membership[i].group = await Group.query().where('id', membership[i].group_id)
          membership[i].group = membership[i].group[0]
          membership[i].group.permission_list = JSON.parse(membership[i].group.permission_list)
        }
        groupMembershipCache.store('grps#' + user.id, membership)
      } else {
        groupMembershipCache.store('grps#' + user.id, [])
      }
    }

    return membership
  },
  globalPermissions: async function (user) {
    user = await API.get(user)
    if (user.admin) {
      return adminPerms
    }

    let hasPerms = []

    let groups = await API.getGroups(user)
    if (groups.length) {
      for (let i in groups) {
        let group = groups[i].group
        if (group.permission_list && group.permission_list.nodes) {
          hasPerms = hasPerms.concat(group.permission_list.nodes)
        }
      }
    }

    return hasPerms
  },
  hasPermission: async function (user, perm) {
    user = await API.get(user)
    if (user.admin) {
      return true
    }

    let hasPerm = false

    let groups = await API.getGroups(user)
    if (groups.length) {
      for (let i in groups) {
        if (groups[i].group.permission_list.indexOf(perm) !== -1) {
          hasPerm = true
          break
        }
      }
    }

    return hasPerm
  },
  permssionsOnCategory: async function (user, cat) {
    if (!user) return []
    if (!cat.id) return []
    if (!cat.permission_list) return []
    if (user.admin === true) return adminPerms
    let groups = await API.getGroups(user)

    let permsAvail = []
    let permlist = JSON.parse(cat.permission_list)

    if (groups.length) {
      for (let i in groups) {
        let group = groups[i]
        if (permlist[group.id.toString()]) {
          permsAvail = permsAvail.concat(permlist[group.id.toString()])
        }
      }
    }

    return permsAvail
  }
}

module.exports = API
