const fs = require("fs");
const got = require("got");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const https = require("https");
var fsExtra = require("fs-extra");
const fetch = require("node-fetch");
const cliProgress = require("cli-progress");
const request = require("request");
var http = require("http-get");
const _async = require("async");
const ProgressBar = require("progress");

const URL_ACHIEVEMENTS = "https://retroachievements.org/gameList.php?c=12";
const QUERY_SELECTOR_ACHIEVEMENTS = ".table-wrapper td.w-full a";
const FILE_GAMES_WITH_ACHIEVEMENTS = "psxGamesWithAchievements.json";

const URL_ARCHIVES = "https://archive.org/download/chd_psx/CHD-PSX-USA/";
const QUERY_SELECTOR_ARCHIVES = ".directory-listing-table a";
const FILE_GAMES_WITH_ARCHIVES = "psxGamesWithLinks.json";

const FILE_GAMES_WITH_MATCH_LIST = "matchList.json";

class Downloader {
  constructor() {
    this.q = _async.queue(this.singleFile, 4);

    // assign a callback
    this.q.drain(function () {
      console.log("all items have been processed");
    });

    // assign an error callback
    this.q.error(function (err, task) {
      console.error("task experienced an error", task);
    });
  }

  downloadFiles(links) {
    for (let link of links) {
      this.q.push(link);
    }
  }

  singleFile(link, cb) {
    let file = request(link);
    let bar;
    file.on("response", (res) => {
      const len = parseInt(res.headers["content-length"], 10);
      console.log("Downloading: ", link)
      bar = new ProgressBar("  Downloading [:bar] :rate/bps :percent :etas", {
        complete: "=",
        incomplete: " ",
        width: 40,
        total: len,
      });
      file.on("data", (chunk) => {
        bar.tick(chunk.length);
      });
      file.on("end", () => {
        console.log("\n");
        cb();
      });
    });
    file.pipe(fs.createWriteStream(link.name));
  }
}

const dl = new Downloader();

function downloadAllGames(list) {
  let urlArr = [];
  list.games.forEach((item) => {
    urlArr.push(item);
  });
  dl.downloadFiles([urlArr[0]]);
}

function simplify(name) {
  // Remover nome alternativo
  name = name.split("|")[0];

  let clearName = name
    //Em uma coleção pode haver numeros e outra algarismos romanos
    .replaceAll("IX", "9")
    .replaceAll("VIII", "8")
    .replaceAll("VII", "7")
    .replaceAll("III", "3")
    .replaceAll("II", "2")
    .replaceAll("IV", "4")

    .toUpperCase()

    // Extensões e versões
    .replaceAll("CHD", "")
    .replaceAll("(USA)", "")
    .replaceAll("(EN,FR,DE,ES,IT)", "")
    .replaceAll("(EN,FR,ES)", "")
    .replaceAll("(USA)CHD", "")
    .replaceAll("(EN,JA,FR,DE)", "")
    .replaceAll("(EN,FR,DE,SV)", "")
    .replaceAll("2ND", "SECOND")
    .replaceAll("(Arcade Disc)", "");

  // Tratar o caso de "Bugs Life, A" e "Smurfs, The"
  if (clearName.split(",").length > 1) {
    clearName = clearName.split(",")[1] + clearName.split(",")[0];
  }

  return (
    clearName
      // Discos
      .replaceAll("DISC 1", "")
      .replaceAll("DISC 2", "")
      .replaceAll("DISC 3", "")
      .replaceAll("DISC 4", "")

      // Prefixos que podem atrapalhar
      .replaceAll("WALT", "")
      .replaceAll("DISNEYS", "")
      .replaceAll("DISNEY'S", "")
      .replaceAll("DISNEY", "")
      .replaceAll("PIXAR", "")

      // Caracteres em geral
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
  );
}

function loadAchievements() {
  return got(URL_ACHIEVEMENTS)
    .then((response) => {
      return new JSDOM(response.body);
    })
    .then((dom) => {
      let elements = dom.window.document.querySelectorAll(
        QUERY_SELECTOR_ACHIEVEMENTS
      );
      return elements;
    })
    .then((elements) => {
      let collection = { games: [] };
      elements.forEach((item) => {
        collection.games.push({
          name: item.textContent,
          keywords: simplify(item.textContent),
        });
      });
      return collection;
    })
    .catch((err) => {
      console.error(err);
    });
}

function loadArchives() {
  return got(URL_ARCHIVES)
    .then((response) => {
      return new JSDOM(response.body);
    })
    .then((dom) => {
      let elements = dom.window.document.querySelectorAll(
        QUERY_SELECTOR_ARCHIVES
      );
      return elements;
    })
    .then((elements) => {
      let collection = { games: [] };
      elements.forEach((item) => {
        collection.games.push({
          name: item.textContent,
          keywords: simplify(item.textContent),
          url: URL_ARCHIVES + item.href,
        });
      });
      return collection;
    })
    .catch((err) => {
      console.error(err);
    });
}

function doMissAndMatch(arr) {
  const achievements = arr[0];
  const archives = arr[1];
  let missList = { games: [] };
  let matchList = { games: [] };

  let found = false;
  for (
    let indexCheevo = 0;
    indexCheevo < achievements.games.length;
    indexCheevo++
  ) {
    found = false;
    for (let indexArch = 0; indexArch < archives.games.length; indexArch++) {
      if (indexArch == archives.games.length - 1 && !found) {
        console.log(
          "Match NOT Found:",
          achievements.games[indexCheevo].name +
            " " +
            achievements.games[indexCheevo].keywords
        );
        missList.games.push(achievements.games[indexCheevo]);
      }

      if (
        achievements.games[indexCheevo].keywords ==
        archives.games[indexArch].keywords
      ) {
        //console.log("Match Found: " + archives.games[indexArch].keywords);
        matchList.games.push(archives.games[indexArch]);
        found = true;
      }
    }
  }
  let matchPercent =
    (matchList.games.length /
      (matchList.games.length + missList.games.length)) *
    100;
  let missPercent =
    (missList.games.length / (matchList.games.length + missList.games.length)) *
    100;

  console.log("---------------");
  console.log("Matches TOTAL: " + matchList.games.length);
  console.log("Matches %: " + matchPercent.toFixed(0) + "%");
  console.log("---------------");
  console.log("Misses TOTAL: " + missList.games.length);
  console.log("Misses %: " + missPercent.toFixed(0) + "%");

  downloadAllGames(matchList);
}

Promise.all([loadAchievements(), loadArchives()]).then((x) => {
  doMissAndMatch(x);
});
