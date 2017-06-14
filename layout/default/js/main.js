function fireRequest (url, method = 'GET', data, formHeader = false) {
  return new Promise((resolve, reject) => {
    let xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function () {
      if (this.readyState === 4 && this.status === 200) {
        resolve(xhttp.responseText)
      } else if (this.readyState === 4 && this.status !== 200) {
        reject(xhttp)
      }
    }
    xhttp.open(method, url, true)
    if (formHeader) {
      xhttp.setRequestHeader('Content-type', 'application/json')
    }
    xhttp.send(data)
  })
}

$(document).ready(function () {
  window.editor = function () {
    window.dialog.popScript('Create a new topic', 'composer')
    $('#content').wysibb({minheight: 120})
  }

  if (window.location.hash === '#showEditor') {
    window.location.hash = ''
    setTimeout(() => {
      window.editor()
    }, 500)
  }

  window.editPost = function (id) {
    if (window.editingPost) return

    function message (msg) {
      $('#dialog #ongoingmsg').text(msg)
    }

    fireRequest('/forum/post/' + id).then((res) => {
      let data
      try {
        data = JSON.parse(res)
      } catch (e) {
        console.error(e)
        return
      }

      if (data.error) {
        return alert(data.text)
      }

      window.editingPost = id
      window.dialog.popScript('Editing post', 'posteditor')

      $('#dialog #contentEdit').html(data.content)
      $('#dialog #contentEdit').wysibb({minheight: 120})

      $('#catchForm').submit((e) => {
        e.preventDefault()
        if (!window.editingPost) return
        let content = $('#dialog #contentEdit').bbcode()
        if (!content) return message('Content cannot be empty.')

        fireRequest('/forum/post/' + id, 'POST', JSON.stringify({content: content, csrf: $('#csrf').val()}), true).then((res2) => {
          try {
            data = JSON.parse(res2)
          } catch (e) {
            console.error(e)
            return
          }

          if (data.error) {
            return message(data.text)
          }

          if (data.serialized) {
            $('#post-content-' + id).html(data.serialized)
            $('#post-' + id + ' .edited').html('Edited now')
            window.location.hash = 'post-' + id
          } else {
            window.location = '?findPost=' + id
          }

          window.dialog.close()
          delete window.editingPost
        })
      })
    }, (e) => {
      console.log(e)
      alert('An unexpected error occured.')
    })

    return false
  }

  window.newForum = function (id) {
    window.dialog.popScript('New ' + id ? 'Category' : 'Forum', 'newForumForm')

    function message (msg) {
      $('#dialog #ongoingmsg').text(msg)
    }

    $('#dialog #postforum').submit((e) => {
      e.preventDefault()

      let content = {
        csrf: $('#postforum #csrf').val(),
        title: $('#postforum #title').val(),
        description: $('#postforum #description').val()
      }

      let url = '/api/' + (id ? 'category' : 'forum') + '/create' + (id ? '/' + id : '')

      fireRequest(url, 'POST', JSON.stringify(content), true).then((res) => {
        let data
        try {
          data = JSON.parse(res)
        } catch (e) {
          console.error(e)
          return
        }

        if (data.error) {
          return message(data.error)
        }

        window.location.reload()
      }, (e) => {
        console.error(e)
        message('unexpected server error')
      })
    })
  }
})
