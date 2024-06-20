/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @license Simplified BSD License
 */

import {
  transformReaddir,
  transformArrayBuffer,
  createFileIter
} from './utils/vfs';

/**
 * VFS Method Options
 *
 * TODO: typedef
 * @typedef {Object} VFSMethodOptions
 */

/**
 * VFS Download Options
 *
 * @typedef {Object} VFSDownloadOptions
 * @property {boolean} [readfile] Set to false to force backend fetch
 */

/**
 * VFS File Object
 *
 * @typedef {Object} VFSFile
 * @property {string} path
 * @property {string} [filename]
 * @property {boolean} [isDirectory]
 * @property {boolean} [isFile]
 * @property {string} [mime]
 * @property {object} [stat]
 */

// Cache the capability of each mount point
let capabilityCache = {};

// Makes sure our input paths are object(s)
const pathToObject = path => ({
  id: null,
  ...typeof path === 'string' ? {path} : path
});

// Handles directory listing result(s)
const handleDirectoryList = (path, options) => result =>
  Promise.resolve(result.map(stat => createFileIter(stat)))
    .then(result => transformReaddir(pathToObject(path), result, {
      showHiddenFiles: options.showHiddenFiles !== false,
      filter: options.filter
    }));

// Returns a new "options" object without properties from "ignore"
const filterOptions = (ignore, options) => Object.fromEntries(
  Object
    .entries(options)
    .filter(([k]) => !ignore.includes(k))
);

/**
 * Get vfs capabilities
 *
 * @param {string|VFSFile} path The path of a file
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<object[]>} An object of capabilities
 */
export const capabilities = (adapter, mount) => (path, options = {}) => {
  const cached = capabilityCache[mount.name];
  if (cached) {
    return Promise.resolve(cached);
  }
  return adapter.capabilities(pathToObject(path), options, mount)
    .then(res => {
      capabilityCache[mount.name] = res;
      return res;
    });
};


/**
 * Read a directory
 *
 * @param {string|VFSFile} path The path to read
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<object[]>} A list of files
 */
export const readdir = (adapter, mount) => (path, options = {}) =>
  adapter.readdir(pathToObject(path), filterOptions(['showHiddenFiles', 'filter'], options), mount)
    .then(handleDirectoryList(path, options));

/**
 * Reads a file
 *
 * Available types are 'arraybuffer', 'blob', 'uri' and 'string'
 *
 * @param {string|VFSFile} path The path to read
 * @param {string} [type=string] Return this content type
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<ArrayBuffer>}
 */
export const readfile = (adapter, mount) => (path, type = 'string', options = {}) =>
  adapter.readfile(pathToObject(path), type, options, mount)
    .then(response => transformArrayBuffer(response.body, response.mime, type));

/**
 * Writes a file
 * @param {string|VFSFile} path The path to write
 * @param {ArrayBuffer|Blob|string} data The data
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<number>} File size
 */
export const writefile = (adapter, mount) => (path, data, options = {}) => {
  const binary = (data instanceof ArrayBuffer || data instanceof Blob)
    ? data
    : new Blob([data], {type: 'application/octet-stream'});

  return adapter.writefile(pathToObject(path), binary, options, mount);
};

/**
 * Copies a file or directory (move)
 * @param {string|VFSFile} from The source (from)
 * @param {string|VFSFile} to The destination (to)
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const copy = (adapter, mount) => (from, to, options = {}) =>
  adapter.copy(pathToObject(from), pathToObject(to), options, mount);

/**
 * Renames a file or directory (move)
 * @param {string|VFSFile} from The source (from)
 * @param {string|VFSFile} to The destination (to)
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const rename = (adapter, mount) => (from, to, options = {}) =>
  adapter.rename(pathToObject(from), pathToObject(to), options, mount);

/**
 * Alias of 'rename'
 * @param {string|VFSFile} from The source (from)
 * @param {string|VFSFile} to The destination (to)
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const move = rename;

/**
 * Creates a directory
 * @param {string|VFSFile} path The path to new directory
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const mkdir = (adapter, mount) => (path, options = {}) =>
  adapter.mkdir(pathToObject(path), options, mount);

/**
 * Removes a file or directory
 * @param {string|VFSFile} path The path to remove
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const unlink = (adapter, mount) => (path, options = {}) =>
  adapter.unlink(pathToObject(path), options, mount);

/**
 * Checks if path exists
 * @param {string|VFSFile} path The path to check
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<boolean>}
 */
export const exists = (adapter, mount) => (path, options = {}) =>
  adapter.exists(pathToObject(path), options, mount);

/**
 * Gets the stats of the file or directory
 * @param {string|VFSFile} path The path to check
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<object>}
 */
export const stat = (adapter, mount) => (path, options = {}) =>
  adapter.stat(pathToObject(path), options, mount)
    .then(stat => createFileIter(stat));

/**
 * Gets an URL to a resource defined by file
 * @param {string|VFSFile} path The file
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<string>}
 */
export const url = (adapter, mount) => (path, options = {}) =>
  adapter.url(pathToObject(path), options, mount);

/**
 * Initiates a native browser download of the file
 * @param {string|VFSFile} path The file
 * @param {VFSDownloadOptions} [options] Options
 * @return {Promise<any>}
 */
export const download = (adapter, mount) => (path, options = {}) =>
  typeof adapter.download === 'function' && options.readfile !== true
    ? adapter.download(pathToObject(path), options, mount)
    : readfile(adapter)(path, 'blob')
      .then(body => {
        const filename = pathToObject(path).path.split('/').splice(-1)[0];
        const url = window.URL.createObjectURL(body);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);

        a.click();

        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          a.remove();
        }, 1);
      });

/**
 * Searches for files and folders
 * @param {string|VFSFile} root The root
 * @param {string} pattern Search pattern
 * @param {VFSMethodOptions} [options] Options
 * @return {Promise<object[]>} A list of files
 */
export const search = (adapter, mount) => (root, pattern, options = {}) => {
  if (mount.attributes && mount.attributes.searchable === false) {
    return Promise.resolve([]);
  }

  return adapter.search(pathToObject(root), pattern, options, mount)
    .then(handleDirectoryList(root, options));
};

/**
 * Touches a file
 * @param {string|VFSFile} path File path
 * @return {Promise<boolean>}
 */
export const touch = (adapter, mount) => (path, options = {}) =>
  adapter.touch(pathToObject(path), options, mount);
