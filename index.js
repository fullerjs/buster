'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mm = require('micromatch');

let cache = {};

let insertBeforeExt = function(filepath, str) {
  let parts = filepath.split('.');
  let ext = parts.pop();
  return parts.join('.') + str + '.' + ext;
};

let replaceCachedFilenames = function(str) {
  const filenames = Object.keys(cache);

  if (!filenames.length) {
    return str;
  }

  let rx = new RegExp( '(' + Object.keys(cache).join('|') + ')', 'g');
  return str.replace(rx, name => cache[name]);
};

let getPrevFiles = function(dst, cb) {
  fs.readdir(dst.dirname, (err, files) => {
    if (err) {
      return cb(err);
    }

    cb(null, mm.match(files, insertBeforeExt(dst.basename, '*')));
  });
};

let removeFiles = function(dir, files, cb) {
  let i = files.length;

  if (!i) {
    return cb();
  }

  files.forEach(filepath => {
    fs.unlink(path.join(dir, filepath), function(err) {
      i--;
      if (err) {
        return cb(err);
      }

      if (i <= 0) {
        cb();
      }
    });
  });
}

module.exports = function(f, mat, options, next) {
  let dst = mat.dst();
  getPrevFiles(dst, (err, files) => {
    if (err) {
      console.log(`Buster can\'t read a directory: ${err}`);
      return next(null, mat);
    }

    mat.getContent(content => {
      content = content.toString();
      const hash = crypto.createHash('md5').update(content).digest('hex');
      cache[dst.basename] = insertBeforeExt(dst.basename, '.' + hash);

      mat
        .dst(insertBeforeExt(dst.path, '.' + hash))
        .setContent(replaceCachedFilenames(content));

      let newFileName = mat.dst().basename;
      files = files.filter(file => file !== newFileName);
      removeFiles(dst.dirname, files, err => {
        if (err) {
          console.log(`Buster can\'t remove a file: ${err}`);
        }

        next(null, mat);
      });
    });
  });
};
