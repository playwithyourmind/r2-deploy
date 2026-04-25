const mime = require('mime-types');

function getContentType(key) {
  return mime.lookup(key) || 'application/octet-stream';
}

module.exports = { getContentType };
