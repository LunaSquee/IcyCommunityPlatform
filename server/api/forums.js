import db from '../../utility/database'
import slugify from '../../utility/slug'
import render from '../../utility/contentfilter'

import Cache from './memcache'
import users from './users'
import stream from './stream'

import runtime from '../runtime'

const Model = db.Model

class Forum extends Model {
  static get tableName () {
    return 'forums'
  }
}

class Category extends Model {
  static get tableName () {
    return 'categories'
  }
}

class Topic extends Model {
  static get tableName () {
    return 'topics'
  }
}

class Post extends Model {
  static get tableName () {
    return 'posts'
  }
}

let topicReadCache = new Cache(1200000)

function paginate (page, count, perPage) {
  let pageCount = Math.ceil(count / perPage)
  if (page > pageCount && page !== 1) page = pageCount

  let offset = (page - 1) * perPage
  return {offset: offset, pageCount: pageCount}
}

const API = {
  Model: {
    Forum: Forum,
    Category: Category,
    Topic: Topic,
    Post: Post
  },
  getCategoriesInForum: async (forum, includeLatestPost, user) => {
    let cats = await Category.query().where('forum_id', forum.id).orderBy('priority')

    for (let i in cats) {
      let cat = cats[i]

      let perms = await users.permssionsOnCategory(user, cat)
      cat.permission_list = perms

      if (includeLatestPost) {
        // Get the latest post
        let latestPost = await Post.query().where('category_id', cat.id).orderBy('id', 'desc').limit(1)

        // Get the count of topics
        let topicCount = await Topic.query().count('id as counts').where('category_id', cat.id)

        if (latestPost.length) {
          latestPost = latestPost[0]
          latestPost.user = await users.getPublicProfile(latestPost.user_id)
          cat['latest_reply'] = latestPost
        }

        // Get count of replies to all topics in this category
        let replyCount = await Post.query().count('id as counts').where('category_id', cat.id)
        cat.topics = topicCount[0].counts
        cat.replies = replyCount[0].counts - cat.topics
      }
    }

    return cats
  },
  getPostsInTopic: async (topic, page, perPage, user, ip) => {
    if (!topic.id) {
      let t = await Topic.query().where('id', topic)
      if (!t.length) {
        return {success: false, error: 'No such topic!'}
      }
      topic = t[0]
    }

    if (topic.read_by === null) topic.read_by = ''
    let readByUsers = topic.read_by.split('|')

    // Get the amount of posts in order to do pagination
    let postCount = await Post.query().count('id as counts').where('topic_id', topic.id)
    if (postCount.length) {
      postCount = postCount[0].counts
    } else {
      postCount = 0
    }

    // Calculate offset
    perPage = perPage || runtime.get('postsPerPage')
    let pageinfo = paginate(page, postCount, perPage)

    // Check if this user already visited this page
    let addRead = true
    if (topicReadCache.get('read#' + topic.id + ':' + user ? user.id : ip)) {
      addRead = false
    }

    if (addRead && page === pageinfo.pageCount) {
      // Add user into the read by list
      if (user && readByUsers.indexOf(user.id) === -1) {
        readByUsers.push(user.id)
      }

      // Add a cache entry so that we don't let unregistered users spam more views with refreshing
      topicReadCache.store('read#' + topic.id + ':' + user ? user.id : ip, true)

      // Update topic with new views and new readers
      topic.views++
      await Topic.query().patchAndFetchById(topic.id, {views: topic.views, read_by: readByUsers.length ? readByUsers.join('|') : ''})
    }

    // Query offset posts
    let posts = await Post.query().where('topic_id', topic.id).offset(pageinfo.offset).limit(perPage)

    let category = await Category.query().where('id', topic.category_id)
    category = category[0]
    let perms = await users.permssionsOnCategory(user, category)
    category.permission_list = perms

    // Add user info and render posts
    for (let i in posts) {
      let guser = await users.getPublicProfile(posts[i].user_id)
      posts[i].user = guser
      posts[i].blocked = posts[i].blocked === 1

      if (posts[i].blocked) {
        posts[i].content = 'Content removed by a moderator'
      } else {
        posts[i].content = render(posts[i].content)
      }
    }

    return {
      page: {
        current: page,
        perPage: perPage,
        pages: pageinfo.pageCount
      },
      category: category,
      topic: topic,
      posts: posts
    }
  },
  getTopicsInCategory: async (category, page, perPage, user) => {
    if (!category.id) {
      let t = await Category.query().where('id', category)
      if (!t.length) {
        return {success: false, error: 'No such category!'}
      }
      category = t[0]
    }
    // Get the amount of topics in this category
    let topicCount = await Topic.query().count('id as counts').where('category_id', category.id)
    if (topicCount.length) {
      topicCount = topicCount[0].counts
    } else {
      topicCount = 0
    }

    let perms = await users.permssionsOnCategory(user, category)
    category.permission_list = perms

    // Calculate offset
    perPage = perPage || runtime.get('topicsPerPage')
    let pageinfo = paginate(page, topicCount, perPage)

    // Query offset topics
    let topics = await Topic.query().where('category_id', category.id).offset(pageinfo.offset).limit(perPage).orderBy('updated_at', 'desc')

    // Add latest reply to all topics
    for (let i in topics) {
      let topic = topics[i]

      // Pull latest reply to topic
      let latestReply = await API.getLatestPost(topic)

      if (latestReply) {
        topic['latest_reply'] = latestReply
      }

      topic['read'] = topic.read_by && user ? topic.read_by.split('|').indexOf(user.id.toString()) !== -1 : false

      // Pull total reply count
      let replyCount = await Post.query().count('id as counts').where('topic_id', topic.id)
      topic['replies'] = replyCount[0].counts - 1
    }

    return {
      page: {
        current: page,
        perPage: perPage,
        pages: pageinfo.pageCount
      },
      category: category,
      topics: topics
    }
  },
  getPostPage: async (post, perPage) => {
    perPage = perPage || runtime.get('postsPerPage')
    post = await Post.query().where('id', post)
    if (!post.length) return null
    post = post[0]
    let indexOfPost = 0

    let postsInTopic = await Post.query().where('topic_id', post.topic_id)
    for (let i in postsInTopic) {
      let postit = postsInTopic[i]
      if (postit.id === post.id) {
        indexOfPost = parseInt(i)
      }
    }

    let page = Math.floor(indexOfPost / perPage) + 1
    if (page === 0) page = 1
    return page
  },
  getLatestPost: async (topic) => {
    if (!topic.id) {
      let t = await Topic.query().where('id', topic)
      if (!t.length) {
        return {success: false, error: 'No such topic!'}
      }
      topic = t[0]
    }

    let post = await Post.query().where('topic_id', topic.id).orderBy('created_at', 'desc').limit(1)
    if (!post.length) return null
    post = post[0]

    let getuser = await users.getPublicProfile(post.user_id)
    post.user = getuser

    return post
  },
  getListForums: async (includeLatestPost, user) => {
    let forums = await Forum.query().orderBy('priority')

    // List all forums and their categories
    for (let i in forums) {
      let forum = forums[i]
      let categories = await API.getCategoriesInForum(forum, includeLatestPost, user)
      forum['categories'] = categories
    }

    return forums
  },
  permissionInCategory: async (user, category, perm) => {
    if (!category.id) {
      category = await Category.query().where('id', category)
      category = category[0]
    }

    if (category.permission_list == null) return false

    if (typeof category.permission_list !== 'object') {
      let perms = await users.permssionsOnCategory(user, category)
      category.permission_list = perms
    }

    return category.permission_list.indexOf(perm) !== -1
  },
  createTopic: async (category, title, content, ip, user) => {
    if (!category.id) {
      let t = await Category.query().where('id', category)
      if (!t.length) {
        return {success: false, error: 'No such category!'}
      }
      category = t[0]
    }

    if (!await API.permissionInCategory(user, category, 'topic.create')) {
      return {success: false, error: 'You cannot create topics here!'}
    }

    let topicStruct = {
      title: title,
      slug: slugify(title),
      category_id: category.id,
      user_id: user.id,
      created_at: new Date(),
      updated_at: new Date(),
      post_id: 0,
      listeners: '[]'
    }

    let topic = await Topic.query().insert(topicStruct)

    let postStruct = {
      category_id: category.id,
      topic_id: topic.id,
      user_id: user.id,
      content: content,
      created_at: new Date(),
      ip_address: ip,
      title: title
    }

    let post = await Post.query().insert(postStruct)

    stream.emit('forum:topic', {
      id: topic.id,
      title: title,
      user: user.display_name,
      category: category.title,
      uri: topic.id + '-' + topic.slug
    })

    return {
      success: true,
      topic: topic,
      post: post
    }
  },
  getPostByID: async(id) => {
    let post = await Post.query().where('id', id)

    if (!post.length) {
      return null
    }
    post = post[0]

    let user = await users.getPublicProfile(post.user_id)
    post.user = user

    return post
  },
  addReply: async (topic, content, ip, user) => {
    if (!topic.id) {
      let t = await Topic.query().where('id', topic)
      if (!t.length) {
        return {success: false, error: 'No such topic!'}
      }
      topic = t[0]
    }

    if (!await API.permissionInCategory(user, topic.category_id, 'topic.reply')) {
      return {success: false, error: 'You cannot reply to topics here!'}
    }

    if (topic.locked === 1 && !await API.permissionInCategory(user, topic.category_id, 'forum.post.locked')) {
      return {success: false, error: 'This topic is locked!'}
    }

    if (content.length < 20 && !await API.permissionInCategory(user, topic.category_id, 'post.length.bypass')) {
      return {success: false, error: 'Your message is too short!'}
    }

    let postStruct = {
      category_id: topic.category_id,
      topic_id: topic.id,
      user_id: user.id,
      content: content,
      created_at: new Date(),
      ip_address: ip,
      title: 'RE: ' + topic.title
    }

    let post = await Post.query().insert(postStruct)
    await Topic.query().patchAndFetchById(topic.id, {read_by: '', updated_at: new Date()})

    stream.emit('forum:post', {
      id: post.id,
      topic: topic.title,
      title: postStruct.title,
      content: content,
      user: user.display_name,
      uri: topic.id + '-' + topic.slug + '?findPost=' + post.id
    })

    return {
      success: true,
      post: post
    }
  },
  editReply: async (post, content, ip, user) => {
    if (!post.id) {
      let t = await Post.query().where('id', post)
      if (!t.length) {
        return {success: false, error: 'No such reply!'}
      }
      post = t[0]
    }

    let topic = await Topic.query().where('id', post.topic_id)

    if (!topic.length) {
      return {success: false, error: 'The topic has disappeared!\nIf you believe this is an error, please contact an administrator!'}
    }

    topic = topic[0]

    let category = await Category.query().where('id', topic.category_id)
    category = category[0]

    if (topic.locked === 1 && !await API.permissionInCategory(user, category, 'forum.post.locked')) {
      return {success: false, error: 'This topic is locked!'}
    }

    if (post.blocked === 1 && !await API.permissionInCategory(user, category, 'forum.edit.blocked')) {
      return {success: false, error: 'This reply has been blocked by an administrator!'}
    }

    if (user.id !== post.user_id && !await API.permissionInCategory(user, category, 'forum.edit.other')) {
      return {success: false, error: 'You do not have permission to edit this reply!'}
    }

    let edited = await Post.query().patchAndFetchById(post.id, {
      updated_at: new Date(),
      content: content,
      ip_address: ip
    })

    return {
      success: true,
      reply: edited,
      serialized: render(content)
    }
  },
  addForum: async (title, description, user) => {
    let latest = await Forum.query().orderBy('priority', 'desc').limit(1)
    if (!latest.length) {
      latest = 0
    } else {
      latest = latest[0].priority
    }
/*
    if (!await users.hasPermission(user, 'forum.create')) {
      return {success: false, error: 'You do not have permission to create forums!'}
    }
*/
    let construct = {
      title: title,
      slug: slugify(title),
      description: description,
      priority: latest + 1,
      created_at: new Date()
    }

    let forum = await Forum.query().insert(construct)

    return {success: true, forum: forum}
  },
  addCategory: async (forum, title, description, parent, user) => {
    if (!forum.id) {
      let t = await Forum.query().where('id', forum)
      if (!t.length) {
        return {success: false, error: 'No such forum!'}
      }
      forum = t[0]
    }
/*
    if (!await users.hasPermission(user, 'forum.create')) {
      return {success: false, error: 'You do not have permission to create categories!'}
    }
*/
    let latest = await Category.query().orderBy('priority', 'desc').limit(1).where('forum_id', forum.id)
    if (!latest.length) {
      latest = 0
    } else {
      latest = latest[0].priority
    }

    let construct = {
      parent_id: parent,
      forum_id: forum.id,
      title: title,
      slug: slugify(title),
      description: description,
      permission_list: '{"1": ["topic.create", "topic.reply"]}',
      priority: latest + 1,
      created_at: new Date()
    }

    let category = await Category.query().insert(construct)

    return {success: true, category: category}
  }
}

module.exports = API
