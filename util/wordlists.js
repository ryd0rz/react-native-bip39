let fetch = require('node-fetch')
let fs = require('fs')
let path = require('path')

let log = console.log
let WORDLISTS = [
  'chinese_simplified',
  'chinese_traditional',
  'english',
  'french',
  'italian',
  'japanese',
  'spanish',
  'korean'
]

function update () {
  download().then(function (wordlists) {
    let promises = Object.keys(wordlists).map(function (name) { return save(name, wordlists[name]) })
    return Promise.all(promises)
  })
}

function download () {
  let wordlists = {}

  let promises = WORDLISTS.map(function (name) {
    return fetchRaw(name).then(toJSON).then(function (wordlist) { wordlists[name] = wordlist })
  })

  return Promise.all(promises).then(function () { return wordlists })
}

function fetchRaw (name) {
  let url = 'https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/' + name + '.txt'
  log('download ' + url)

  return fetch(url).then(function (response) { return response.text() })
}

function toJSON (content) {
  return content.trim().split('\n').map(function (word) { return word.trim() })
}

function save (name, wordlist) {
  let location = path.join(__dirname, '..', 'wordlists', name + '.json')
  let content = JSON.stringify(wordlist, null, 2) + '\n'
  log('save ' + wordlist.length + ' words to ' + location)

  return new Promise(function (resolve, reject) {
    fs.writeFile(location, content, function (err) {
      if (err) reject(err)
      else resolve()
    })
  })
}

module.exports = { update: update, download: download }
