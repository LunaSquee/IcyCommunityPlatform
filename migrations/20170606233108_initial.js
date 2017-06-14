
exports.up = function (knex, Promise) {
  return Promise.all([
    knex.schema.createTable('users', (table) => {
      table.increments('id').primary()

      table.string('username', 26).unique().notNullable()
      table.string('display_name', 32).notNullable()
      table.string('email').notNullable()
      table.string('avatar_file').defaultTo('')
      table.string('user_title').defaultTo('')

      table.text('password').notNullable()

      table.json('profile')
      table.json('notif_prefs')

      table.boolean('activated').defaultTo(false)
      table.boolean('locked').defaultTo(false)
      table.boolean('admin').defaultTo(false)

      table.text('signature')

      table.string('ip_address').notNullable()

      table.dateTime('activity_at')
      table.timestamps()
    }),
    knex.schema.createTable('forums', (table) => {
      table.increments('id').primary()

      table.string('title').notNullable()
      table.string('slug', 16)
      table.string('description').defaultTo('')
      table.integer('priority').defaultTo(0)

      table.timestamps()
    }),
    knex.schema.createTable('categories', (table) => {
      table.increments('id').primary()
      table.integer('forum_id').unsigned().notNullable()
      table.integer('parent_id').unsigned().defaultTo(0)

      table.string('title').notNullable()
      table.string('slug', 16)
      table.string('description').defaultTo('')
      table.integer('priority').defaultTo(0)

      table.json('permission_list')

      table.foreign('forum_id').references('forums.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('topics', (table) => {
      table.increments('id').primary()
      table.integer('category_id').unsigned().notNullable()
      table.integer('post_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()

      table.string('title').notNullable()
      table.string('slug', 16)

      table.boolean('locked').defaultTo(false)
      table.boolean('pinned').defaultTo(false)
      table.boolean('moved').defaultTo(false)

      table.integer('activity').defaultTo(0)
      table.integer('views').defaultTo(0)

      table.json('listeners')
      table.text('read_by')

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.foreign('category_id').references('categories.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('posts', (table) => {
      table.increments('id').primary()
      table.integer('topic_id').unsigned().notNullable()
      table.integer('category_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()

      table.string('title').notNullable()

      table.text('content')

      table.boolean('blocked').defaultTo(false)
      table.string('ip_address').notNullable()

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.foreign('topic_id').references('topics.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('blogs', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()

      table.string('title').notNullable()
      table.string('slug', 16)

      table.text('content')

      table.json('permission_list')
      table.json('listeners')

      table.boolean('blocked').defaultTo(false)

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('blog_entries', (table) => {
      table.increments('id').primary()
      table.integer('blog_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()

      table.string('title').notNullable()
      table.string('slug', 16)

      table.text('content')

      table.boolean('locked').defaultTo(false)
      table.boolean('hidden').defaultTo(false)
      table.boolean('blocked').defaultTo(false)

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.foreign('blog_id').references('blogs.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('status_updates', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()

      table.text('content')

      table.boolean('locked').defaultTo(false)
      table.boolean('hidden').defaultTo(false)

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('comments', (table) => {
      table.increments('id').primary()

      table.string('resource').notNullable() // blog_entry:id, status_update:id

      table.integer('user_id').unsigned().notNullable()
      table.integer('parent_id').defaultTo(0)

      table.text('content')

      table.boolean('blocked').defaultTo(false)
      table.string('ip_address').notNullable()

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('logins', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()

      table.text('user_agent')
      table.string('ip_address').notNullable()

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('activation_tokens', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.text('token')
      table.text('email')

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.dateTime('expires_at')
    }),
    knex.schema.createTable('push_notifs', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.string('image_file').defaultTo('')
      table.text('content')
      table.text('link')

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.boolean('read').defaultTo(false)
      table.timestamps()
    }),
    knex.schema.createTable('webhooks', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.string('resource').notNullable() // blog:id, topic:id, category:id, user:id
      table.text('url')
      table.text('secret')

      table.boolean('active').defaultTo(true)

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('groups', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.string('title').notNullable()
      table.string('slug', 16)
      table.string('avatar_file').defaultTo('')
      table.string('user_title').defaultTo('')

      table.text('content')

      table.boolean('active').defaultTo(true)
      table.boolean('removable').defaultTo(false)

      table.json('permission_list')

      table.timestamps()
    }),
    knex.schema.createTable('group_members', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.integer('group_id').notNullable()

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('likes', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.string('resource').notNullable() // blog_entry:id, status_update:id, post:id

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('followings', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.integer('target_user_id').unsigned().notNullable()

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')
      table.foreign('target_user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')

      table.timestamps()
    }),
    knex.schema.createTable('private_messages', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.integer('target_user_id').unsigned().notNullable()

      table.string('title').notNullable()
      table.string('slug', 16)

      table.text('content')

      table.boolean('user_archived').defaultTo(false)
      table.boolean('target_user_archived').defaultTo(false)

      table.dateTime('read_at').defaultTo(null)
      table.timestamps()
    }),
    knex.schema.createTable('files', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.string('resource')

      table.text('path')

      table.timestamps()
    }),
    knex.schema.createTable('bans', (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.integer('banned_id')
      table.string('ip_address')

      table.text('reason')

      table.dateTime('expires_at')
      table.timestamps()
    }),
    knex.schema.createTable('totp_tokens', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()

      table.text('token').notNullable()
      table.text('recovery_code').notNullable()

      table.dateTime('created_at')

      table.foreign('user_id').references('users.id').onDelete('CASCADE').onUpdate('CASCADE')
    })
  ])
}

exports.down = function (knex, Promise) {
  return Promise.all([
    knex.schema.dropTable('users'),
    knex.schema.dropTable('forums'),
    knex.schema.dropTable('categories'),
    knex.schema.dropTable('topics'),
    knex.schema.dropTable('posts'),
    knex.schema.dropTable('blogs'),
    knex.schema.dropTable('blog_entries'),
    knex.schema.dropTable('status_updates'),
    knex.schema.dropTable('comments'),
    knex.schema.dropTable('activation_tokens'),
    knex.schema.dropTable('push_notifs'),
    knex.schema.dropTable('logins'),
    knex.schema.dropTable('private_messages'),
    knex.schema.dropTable('likes'),
    knex.schema.dropTable('followings'),
    knex.schema.dropTable('groups'),
    knex.schema.dropTable('group_members'),
    knex.schema.dropTable('webhooks'),
    knex.schema.dropTable('files'),
    knex.schema.dropTable('bans'),
    knex.schema.dropTable('totp_tokens')
  ])
}
