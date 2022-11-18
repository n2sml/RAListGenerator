const fs = require('fs')
const got = require('got')
const jsdom = require("jsdom")
const { JSDOM } = jsdom

const URL_ACHIEVEMENTS = 'https://retroachievements.org/gameList.php?c=12'
const QUERY_SELECTOR_ACHIEVEMENTS = '.table-wrapper td.w-full a'
const FILE_GAMES_WITH_ACHIEVEMENTS = 'psxGamesWithAchievements.json'

const URL_ARCHIVES = 'https://archive.org/download/chd_psx/CHD-PSX-USA/'
const QUERY_SELECTOR_ARCHIVES = '.directory-listing-table a'
const FILE_GAMES_WITH_LINKS = 'psxGamesWithLinks.json'

const FILE_GAMES_WITH_MATCH_LIST = 'matchList.json'

function simplify(name) {
    name = name.split(",")[0]
    const clearName = name.toUpperCase()
        .replaceAll("IX", "9")
        .replaceAll("VIII", "8")
        .replaceAll("VII", "7")
        .replaceAll("III", "3")
        .replaceAll("II", "2")
        //.replaceAll("Rev 1", "")
        .replaceAll("CHD", "")
        .replaceAll("(USA)", "")
        .replaceAll("(EN,FR,DE,ES,IT)", "")
        //.replaceAll("(Beta)chd", "")
        //.replaceAll("(EnEs)chd", "")
        .replaceAll("(USA)CHD", "")
        .replaceAll("(EN,JA,FR,DE)", "")
        .replaceAll("2ND", "SECOND")
        //.replaceAll("(Unl)chd", "")
        .replaceAll("DISC 1", "")
        .replaceAll("DISC 2", "")
        .replaceAll("DISC 3", "")
        .replaceAll("DISC 4", "")
        .replaceAll("|", "")
        .replaceAll(":", "")
        .replaceAll("&", "")
        .replaceAll(",", "")
        .replaceAll(".", "")
        .replaceAll("'", "")
        .replaceAll("-", "")
        .replaceAll("!", "")
        .replaceAll("(", "")
        .replaceAll(")", "")
        .replaceAll("[", "")
        .replaceAll("]", "")
        .replaceAll(" ", "")
    return clearName
}

got(URL_ACHIEVEMENTS).then(response => {
    const dom = new JSDOM(response.body);
    let collection = { games: [] }
    let elements = dom.window.document.querySelectorAll(QUERY_SELECTOR_ACHIEVEMENTS)

    elements.forEach(item => {
        console.log(item)
        collection.games.push({
            name: item.textContent,
            keywords: simplify(item.textContent),
        })
    })

    fs.writeFile(FILE_GAMES_WITH_ACHIEVEMENTS, JSON.stringify(collection, null, 2), (err) => {
        if (err) throw err;
    });
}).catch(err => {
    console.log(err);
});

got(URL_ARCHIVES).then(response => {
    const dom = new JSDOM(response.body);
    let collection = { games: [] }
    let elements = dom.window.document.querySelectorAll(QUERY_SELECTOR_ARCHIVES)

    elements.forEach(item => {
        collection.games.push({
            name: item.textContent,
            keywords: simplify(item.textContent),
            url: URL_ARCHIVES + item.href
        })
    })

    // Go to parent directory
    collection.games.shift()

    fs.writeFile(FILE_GAMES_WITH_LINKS, JSON.stringify(collection, null, 2), (err) => {
        if (err) throw err;
    });
}).catch(err => {
    console.log(err);
});


let gamesWithAchievements = JSON.parse(fs.readFileSync(FILE_GAMES_WITH_ACHIEVEMENTS));
let gamesWithLinks = JSON.parse(fs.readFileSync(FILE_GAMES_WITH_LINKS));

let matchList = { games: [] }
let missList = { games: [] }

let found

for (let indexCheevo = 0; indexCheevo < gamesWithAchievements.games.length; indexCheevo++) {
    found = false
    for (let indexGame = 0; indexGame < gamesWithLinks.games.length; indexGame++) {

        if (indexGame == gamesWithLinks.games.length - 1 && !found) {
            console.log("Match NOT Found: " + gamesWithAchievements.games[indexCheevo].keywords)
            missList.games.push(gamesWithAchievements.games[indexCheevo])
        }

        if (gamesWithAchievements.games[indexCheevo].keywords == gamesWithLinks.games[indexGame].keywords) {
            //console.log("Match Found: " + gamesWithLinks.games[indexGame].keywords)
            matchList.games.push(gamesWithLinks.games[indexGame])
            found = true
            //break
        }
    }
}

fs.writeFile(FILE_GAMES_WITH_MATCH_LIST, JSON.stringify(matchList, null, 2), (err) => {
    if (err) throw err;
});

let matchPercent = matchList.games.length / (matchList.games.length + missList.games.length) * 100
let missPercent = missList.games.length / (matchList.games.length + missList.games.length) * 100

console.log("---------------")
console.log("Matches TOTAL: " + matchList.games.length)
console.log("Matches %: " + matchPercent.toFixed(0) + "%")
console.log("---------------")
console.log("Misses TOTAL: " + missList.games.length)
console.log("Misses %: " + missPercent.toFixed(0) + "%")