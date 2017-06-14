var options = { classPrefix: 'bbcode', newLine: false, allowData: false, allowClasses: false }

var regex = /\[(\w+)(?:[= ]([^\]]+))?\]((?:.|[\r\n])*?)\[\/\1\]/ig

const parseAttributes = (tag, attrs) => {
  let obj = {attr: {}, class: [], data: {}}
  if (!attrs) return obj

  attrs = attrs.match(/[a-zA-Z0-9_-]+=([\w\d#]+)?/g)
  if (attrs) {
    for (var i = 0; i < attrs.length; i++) {
      let tmp = attrs[i]
      tmp = tmp.trim().split('=').map((k) => { return k.replace(/(^('|")+|('|")+$)/mg, '') })
      if (tmp[0] === 'class') {
        obj.class.push(tmp[1])
      } else {
        let type = (tmp[0].includes('data-')) ? 'data' : 'attr'
        obj[type][tmp[0]] = tmp[1]
      }
    }
  }

  return obj
}

const parseDataAttrs = (dataList) => {
  let dataTags = ''
  Object.keys(dataList).forEach((b) => { dataTags += ' ' + b + '="' + dataList[b] + '" ' })
  return dataTags
}

const parseTag = (string, tag, attrs, value) => {
  value = String(value).replace(regex, parseTag.bind())
  tag = tag.toLowerCase()
  let val = ''
  let parseAttr = parseAttributes(tag, /\[(.*?)\]/g.exec(string)[1])
  let tagDetails = {
    attr: parseAttr.attr,
    data: (options.allowData) ? parseDataAttrs(parseAttr.data) : '',
    class: (options.allowClasses) ? options.classPrefix + ' ' + parseAttr.class.join(' ') + ' ' : options.classPrefix + ' '
  }

  switch (tag) {
    case 'quote':
      val = '<div class="' + tagDetails.class + 'quote"' + tagDetails.data
      if (tagDetails.attr.author) val += ' data-author="' + tagDetails.attr.author + '"'
      if (tagDetails.attr.name) val += ' data-name="' + tagDetails.attr.name + '"'
      return val + '>' + ((tagDetails.attr.name) ? tagDetails.attr.name + ' wrote:' : '') + '<blockquote>' + value + '</blockquote></div>'
    case 'url':
      val = '<a class="' + tagDetails.class + 'link" ' + tagDetails.data
      if (tagDetails.attr.alt) val += ' alt="' + tagDetails.attr.alt + '"'
      return val + ' target="_blank" href="' + tagDetails.attr.url + '" rel="nofollow">' + value + '</a>'
    case 'email':
      val = '<a class="' + tagDetails.class + 'link" ' + tagDetails.data
      if (tagDetails.attr.alt) val += ' alt="' + tagDetails.attr.alt + '"'
      return val + ' target="_blank" href="' + tagDetails.attr.email + '">' + value + '</a>'
    case 'b':
      return '<strong ' + tagDetails.data + ' >' + value + '</strong>'
    case 'i':
      return '<em ' + tagDetails.data + ' >' + value + '</em>'
    case 'u':
      return '<span style="text-decoration:underline" ' + tagDetails.data + ' >' + value + '</span>'
    case 's':
      return '<span style="text-decoration:line-through" ' + tagDetails.data + ' >' + value + '</span>'
    case 'indent':
      return '<blockquote ' + tagDetails.data + ' >' + value + '</blockquote>'
    case 'list':
    case 'ol':
    case 'ul':
      if (tag === 'list') tag = 'ul'
      if (tagDetails.attr.list) tag = 'ol'
      val = '<' + tag + ' ' + tagDetails.data + ' class="' + tagDetails.class + '">'
      val += value.replace(/\[\*\]((?:.|[\r\n])*?)\[\/\*\]/ig, (string, value) => { return '<li>' + value.trim() + '</li>' })
      return val + '</' + tag + '>'
    case 'table':
      tag = 'table'
      val = '<' + tag + ' ' + tagDetails.data + ' class="' + tagDetails.class + '">'
      val += value.replace(/\[tr\]((?:.|[\r\n])*?)\[\/tr\]/ig, (string, value) => { return '<tr>' + value.trim() + '</tr>' })
             .replace(/\[td\]((?:.|[\r\n])*?)\[\/td\]/ig, (string, value) => { return '<td>' + value.trim() + '</td>' })
      return val + '</' + tag + '>'
    case 'code':
    case 'php':
    case 'java':
    case 'javascript':
    case 'cpp':
    case 'ruby':
    case 'python':
      return '<pre class="' + tagDetails.class + (tag === 'code' ? '' : 'code_') + tag + '" ' + tagDetails.data + ' >' + value + '</pre>'
    case 'highlight':
      return '<span class="' + tagDetails.class + tag + '" style="background-color: ' + tagDetails.attr.color + '" ' + tagDetails.data + ' >' + value + '</span>'
    case 'color':
      let color = '#000000'
      if (tagDetails.attr.color) color = tagDetails.attr.color
      if (color.indexOf('#') === 0 && (color.length !== 4 || color.length !== 7)) color = '#000000'
      if (color.indexOf('#') === 0 && color.match(/^#[a-f0-9]+$/g) === null) color = '#000000'
      return '<span class="' + tagDetails.class + tag + '" style="color: ' + tagDetails.attr.color + ';" ' + tagDetails.data + '>' + value + '</span>'
    case 'size':
      let size = 50
      if (tagDetails.attr.size) size = tagDetails.attr.size
      if (size > 200) size = 200
      if (size < 50) size = 50
      size /= 5
      return '<span class="' + tagDetails.class + tag + '" style="font-size: ' + size + 'px;" ' + tagDetails.data + '>' + value + '</span>'
    case 'span':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return '<' + tag + tagDetails.data + '>' + value + '</' + tag + '>'
    case 'img':
      val = '<img class="' + tagDetails.class + 'image" src="' + value + ' ' + tagDetails.data + '"'
      if (tagDetails.attr.width) val += ' width="' + tagDetails.attr.width + 'px"'
      if (tagDetails.attr.height) val += ' height="' + tagDetails.attr.height + 'px"'
      if (tagDetails.attr.title) val += ' title="' + tagDetails.attr.title + '"'
      if (tagDetails.attr.alt) val += ' alt="' + tagDetails.attr.alt + '"'
      return val + '>'
    case 'center':
      return '<div style="text-align: center;" ' + tagDetails.data + ' class="' + tagDetails.class + '">' + value + '</div>'
    case 'left':
      return '<div style="text-align: left;" ' + tagDetails.data + ' class="' + tagDetails.class + '">' + value + '</div>'
    case 'right':
      return '<div style="text-align: right;" ' + tagDetails.data + ' class="' + tagDetails.class + '">' + value + '</div>'
    case 'sup':
      return '<span style="vertical-align: super;" ' + tagDetails.data + ' class="' + tagDetails.class + '">' + value + '</span>'
    case 'sub':
      return '<span style="vertical-align: sub;" ' + tagDetails.data + ' class="' + tagDetails.class + '">' + value + '</span>'
    case 'video':
      return '<iframe src="https://www.youtube.com/embed/' + value + '"' + tagDetails.data + ' class="' + tagDetails.class + '" width="640" height="480" frameborder="0"></iframe>'
  }
//
  return string
}

module.exports = (content, newOptions = {}) => {
  content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  newOptions = Object.assign(options, newOptions)
  if (newOptions.newLine) content = content.replace(/\r?\n/g, '<br>')
  return content.replace(regex, parseTag.bind())
}
