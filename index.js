'use strict'

const _async = require("async");
const fs = require("fs");
const got = require("got");
const jsdom = require("jsdom");
const request = require("request");
const ProgressBar = require("progress");
const { MultiProgressBars } = require('multi-progress-bars');
const chalk = require('chalk');

const URL_ACHIEVEMENTS = "https://retroachievements.org/gameList.php?c=21";
const QUERY_SELECTOR_ACHIEVEMENTS = ".table-wrapper td.w-full a";
const URL_ARCHIVES = "https://archive.org/download/redumpSonyPlaystation2UsaGames2018Aug01";
const QUERY_SELECTOR_ARCHIVES = ".directory-listing-table a";
const ARCHIVES_SIZE = 4;
const PART_SUFIX = "Part";

class Downloader {
  constructor() {
    this.q = _async.queue(this.singleFile, 1);

    this.q.drain(() => console.log("Todos os itens foram processados."));

    this.q.error((err, task) => {
      console.error(err, task);
    });
  }

  downloadFiles(links) {
    console.log("Montando Lista de Download:")
    for (let link of links) {
      !fs.existsSync(link.name)
        ? this.q.push(link)
        : console.log(`Arquivo ${link.name} encontrado.`);
    }
  }

  singleFile(link, callback) {
    let file = request(link);
    let bar = {};

    file.on("response", (response) => {
      const length = parseInt(response.headers["content-length"], 10);
      console.log("Baixando Arquivo:", link.name);
      const mpb = new MultiProgressBars({
        initMessage: ' $ Example Fullstack Build ',
        anchor: 'top',
        persist: false,
        border: true,
      });

      mpb.addTask(link.name, { type: 'percentage', barColorFn: chalk.yellow });

      file.on("data", (chunk) => mpb.incrementTask(link.name, { percentage: chunk.length/length }));
      file.on("end", () => {
        console.log(`Download do arquivo ${link.name} concluido. \n`);
        callback();
      });
    });
    file.pipe(fs.createWriteStream(link.name));
  }
}


const simplify = name => {
  const REGEX_VERSION = /\(V([0-9].[0-9])\w+\)/g
  const REGEX_REGIONS = /\(([A-Z][A-Z],)+([A-Z][A-Z])\)/g
  const REGEX_DISC = /\(DISC +[0-9]\)/g
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

    .replaceAll("(USA)", "")

    // Extensões e versões
    .replaceAll("7Z", "")
    .replaceAll("ZIP", "")   
    .replaceAll(REGEX_VERSION, "")
    .replaceAll(REGEX_REGIONS, "")

    .replaceAll("2ND", "SECOND")
    .replaceAll("(Arcade Disc)", "")

  // Tratar o caso de "Bugs Life, A" e "Smurfs, The"
  if (clearName.split(",").length > 1) {
    clearName = clearName.split(",")[1] + clearName.split(",")[0];
  }

  return (
    clearName
      // Discos
      .replaceAll(REGEX_DISC, "")

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

const downloadAllGames = list => {
  let downloader = new Downloader();
  let urlList = [];
  list.games.forEach((item) => {
    urlList.push(item);
  });
  downloader.downloadFiles(urlList);
}

const getCollectionByUrl = url => {
  return got(url)
    .then((response) => {
      return new jsdom.JSDOM(response.body);
    })
    .then((dom) => {
      let links = dom.window.document.querySelectorAll(QUERY_SELECTOR_ARCHIVES);
      return links;
    })
    .then((elements) => {
      let collection = { games: [] };
      elements.forEach((item) => {
        collection.games.push({
          name: item.textContent,
          keywords: simplify(item.textContent),
          url: URL_ARCHIVES + "/" + item.href,
        });
      });
      return collection;
    })
    .catch((err) => {
      console.error(err);
    });
}

const loadAchievements = () => {
  return got(URL_ACHIEVEMENTS)
    .then((response) => {
      return new jsdom.JSDOM(response.body);
    })
    .then((dom) => {
      let links = dom.window.document.querySelectorAll(
        QUERY_SELECTOR_ACHIEVEMENTS
      );
      return links;
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

const loadArchives = () => {
  let promises = [];

  for (let index = 1; index < ARCHIVES_SIZE + 1; index++) {
    index === 1
      ? promises.push(getCollectionByUrl(URL_ARCHIVES + "/"))
      : promises.push(getCollectionByUrl(URL_ARCHIVES + `${PART_SUFIX}${index}/`));
  }
  return Promise.all(promises).then((collections) => {
    let completeCollection = { games: [] };

    collections.forEach((item) =>
      item.games.forEach((x) => completeCollection.games.push(x))
    );
    return completeCollection;
  });
}

const doMissAndMatch = array => {
  const achievements = array[0];
  const archives = array[1];
  let missList = { games: [] };
  let matchList = { games: [] };

  let found = false;
  for (let i = 0; i < achievements.games.length; i++) {
    found = false;
    for (let j = 0; j < archives.games.length; j++) {
      let archiveGame = archives.games[j];
      let achievementGame = achievements.games[i];

      if (!found) {
        if (j == archives.games.length - 1 && !found) {
          console.log("Jogo não encontrado:", achievementGame.name);
          missList.games.push(achievementGame);
        }
        if (achievementGame.keywords == archiveGame.keywords) {
          matchList.games.push(archiveGame);
          found = true
        }
      }
    }
  }
  //console.log("Jogos Encontrados: ", matchList.games);
 // console.log("Jogos Não Encontrados: ", missList.games);
  console.log("\n");
  downloadAllGames(matchList);
}
module.exports = {
  function () {
    Promise.all([loadAchievements(), loadArchives()]).then((x) => {
      doMissAndMatch(x)
    });  
  }
}
