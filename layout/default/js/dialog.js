$(document).ready(function () {
  let dialog = $('#dialog')
  if (!dialog) return
  let dialogTitle = $('.dialog #dialog-title')
  let dialogContent = $('.dialog #dialog-content')

  dialog.pop = function (title, content) {
    dialogTitle.text(title)
    dialogContent.html(content)
    dialog.fadeIn('fast')
  }

  dialog.popScript = function (title, scriptID) {
    let content = $('#' + scriptID).html()
    dialog.pop(title, content)
  }

  dialog.close = function () {
    if (window.editingPost) delete window.editingPost
    dialog.fadeOut('fast')
  }

  window.dialog = dialog
})
