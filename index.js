let Buffer = require('safe-buffer').Buffer
let createHash= require('hash.js')
let pbkdf2 = require('react-native-fast-crypto').pbkdf2.deriveAsync
let randomBytes = require('react-native-randombytes').randomBytes

// use unorm until String.prototype.normalize gets better browser support
let unorm = require('unorm')

let CHINESE_SIMPLIFIED_WORDLIST = require('./wordlists/chinese_simplified.json')
let CHINESE_TRADITIONAL_WORDLIST = require('./wordlists/chinese_traditional.json')
let ENGLISH_WORDLIST = require('./wordlists/english.json')
let FRENCH_WORDLIST = require('./wordlists/french.json')
let ITALIAN_WORDLIST = require('./wordlists/italian.json')
let JAPANESE_WORDLIST = require('./wordlists/japanese.json')
let KOREAN_WORDLIST = require('./wordlists/korean.json')
let SPANISH_WORDLIST = require('./wordlists/spanish.json')
let DEFAULT_WORDLIST = ENGLISH_WORDLIST

let INVALID_MNEMONIC = 'Invalid mnemonic'
let INVALID_ENTROPY = 'Invalid entropy'
let INVALID_CHECKSUM = 'Invalid mnemonic checksum'

function lpad (str, padString, length) {
  while (str.length < length) str = padString + str
  return str
}

function binaryToByte (bin) {
  return parseInt(bin, 2)
}

function bytesToBinary (bytes) {
  return bytes.map(function (x) {
    return lpad(x.toString(2), '0', 8)
  }).join('')
}

function sha256 (data) {
  data = Buffer.from(data)
  return Hash.sha256().update(data).digest('hex')
}
function deriveChecksumBits (entropyBuffer) {
  let ENT = entropyBuffer.length * 8
  let CS = ENT / 32
  let hash = hash.sha256().update(entropyBuffer).digest('hex')

  return bytesToBinary([].slice.call(hash)).slice(0, CS)
}

function salt (password) {
  return 'mnemonic' + (password || '')
}

async function mnemonicToSeed (mnemonic, password) {
  let mnemonicBuffer = Buffer.from(unorm.nfkd(mnemonic), 'utf8')
  let saltBuffer = Buffer.from(salt(unorm.nfkd(password)), 'utf8')

  // return pbkdf2(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
  return pbkdf2(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
}

async function mnemonicToSeedHex (mnemonic, password) {
  return mnemonicToSeed(mnemonic, password).toString('hex')
}

function mnemonicToEntropy (mnemonic, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST

  let words = unorm.nfkd(mnemonic).split(' ')
  if (words.length % 3 !== 0) throw new Error(INVALID_MNEMONIC)

  // convert word indices to 11 bit binary strings
  let bits = words.map(function (word) {
    let index = wordlist.indexOf(word)
    if (index === -1) throw new Error(INVALID_MNEMONIC)

    return lpad(index.toString(2), '0', 11)
  }).join('')

  // split the binary string into ENT/CS
  let dividerIndex = Math.floor(bits.length / 33) * 32
  let entropyBits = bits.slice(0, dividerIndex)
  let checksumBits = bits.slice(dividerIndex)

  // calculate the checksum and compare
  let entropyBytes = entropyBits.match(/(.{1,8})/g).map(binaryToByte)
  if (entropyBytes.length < 16) throw new Error(INVALID_ENTROPY)
  if (entropyBytes.length > 32) throw new Error(INVALID_ENTROPY)
  if (entropyBytes.length % 4 !== 0) throw new Error(INVALID_ENTROPY)

  let entropy = Buffer.from(entropyBytes)
  let newChecksum = deriveChecksumBits(entropy)
  if (newChecksum !== checksumBits) throw new Error(INVALID_CHECKSUM)

  return entropy.toString('hex')
}

function entropyToMnemonic (entropy, wordlist) {
  if (!Buffer.isBuffer(entropy)) entropy = Buffer.from(entropy, 'hex')
  wordlist = wordlist || DEFAULT_WORDLIST

  // 128 <= ENT <= 256
  if (entropy.length < 16) throw new TypeError(INVALID_ENTROPY)
  if (entropy.length > 32) throw new TypeError(INVALID_ENTROPY)
  if (entropy.length % 4 !== 0) throw new TypeError(INVALID_ENTROPY)

  let entropyBits = bytesToBinary([].slice.call(entropy))
  let checksumBits = deriveChecksumBits(entropy)

  let bits = entropyBits + checksumBits
  let chunks = bits.match(/(.{1,11})/g)
  let words = chunks.map(function (binary) {
    let index = binaryToByte(binary)
    return wordlist[index]
  })

  return wordlist === JAPANESE_WORDLIST ? words.join('\u3000') : words.join(' ')
}

async function generateMnemonic (strength, wordlist) {
  strength = strength || 128
  if (strength % 32 !== 0) throw new TypeError(INVALID_ENTROPY)

  return new Promise((resolve, reject) => {
    randomBytes(strength / 8, (err, buf) => {
      if (err) return reject(err)
      return resolve(entropyToMnemonic(buf, wordlist))
    })
  })
  // return entropyToMnemonic(randomBytes(strength / 8), wordlist)
}

function validateMnemonic (mnemonic, wordlist) {
  try {
    mnemonicToEntropy(mnemonic, wordlist)
  } catch (e) {
    return false
  }

  return true
}

module.exports = {
  mnemonicToSeed: mnemonicToSeed,
  mnemonicToSeedHex: mnemonicToSeedHex,
  mnemonicToEntropy: mnemonicToEntropy,
  entropyToMnemonic: entropyToMnemonic,
  generateMnemonic: generateMnemonic,
  validateMnemonic: validateMnemonic,
  wordlists: {
    EN: ENGLISH_WORDLIST,
    JA: JAPANESE_WORDLIST,

    chinese_simplified: CHINESE_SIMPLIFIED_WORDLIST,
    chinese_traditional: CHINESE_TRADITIONAL_WORDLIST,
    english: ENGLISH_WORDLIST,
    french: FRENCH_WORDLIST,
    italian: ITALIAN_WORDLIST,
    japanese: JAPANESE_WORDLIST,
    korean: KOREAN_WORDLIST,
    spanish: SPANISH_WORDLIST
  }
}
