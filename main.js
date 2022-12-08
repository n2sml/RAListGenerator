'use strict'

const fs = require('fs')
const main = require('./index')
const _async = require("async");

const COLLECTION_FILE = "data.json"

const collections = JSON.parse(fs.readFileSync(COLLECTION_FILE))

let promises = []
collections.consoles.forEach(item => {
    promises.push(main.function)
})

_async.parallel(promises, () => console.log("Concluído!!!"))
