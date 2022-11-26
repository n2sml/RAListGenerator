const fs = require("fs");
const got = require("got");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const request = require("request");
const _async = require("async");
const ProgressBar = require("progress");

const URL_ACHIEVEMENTS = "https://retroachievements.org/gameList.php?c=12";
const QUERY_SELECTOR_ACHIEVEMENTS = ".table-wrapper td.w-full a";

const URL_ARCHIVES = "https://archive.org/download/redump.psx";
const QUERY_SELECTOR_ARCHIVES = ".directory-listing-table a";

const ARCHIVES_SIZE = 4;

class Downloader {
  constructor() {
    this.q = _async.queue(this.singleFile, 1)

    this.q.drain(() => {
      console.log("Todos os itens foram processados.")
    })

    this.q.error((err, task) => {
      console.error(err, task)
    })
  }

  downloadFiles(links) {
    for (let link of links) {
      !fs.existsSync(link.name)? this.q.push(link): console.log(`Arquivo ${link.name} encontrado.`) 
    }
  }

  singleFile(link, cb) {
    let file = request(link);
    let bar

    file.on("response", (res) => {
      const len = parseInt(res.headers["content-length"], 10);
      console.log("Baixando Arquivo: ", link.name);

      bar = new ProgressBar("Progresso => :bar :percent", {
        complete: "=",
        incomplete: " ",
        width: 40,
        total: len,
      })
      file.on("data", (chunk) => {
        bar.tick(chunk.length)          
      });
      file.on("end", () => {
        console.log(`Download do arquivo ${link.name} concluido.`);
        cb()
      });
    });
    file.pipe(fs.createWriteStream(link.name))
  }
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
    .replaceAll("ZIP", "")
    .replaceAll("(USA)", "")
    .replaceAll("(EN,FR,DE,ES,IT)", "")
    .replaceAll("(EN,FR,ES)", "")
    .replaceAll("(USA)ZIP", "")
    .replaceAll("(EN,JA,FR,DE)", "")
    .replaceAll("(EN,FR,DE,SV)", "")
    .replaceAll("2ND", "SECOND")
    .replaceAll("(Arcade Disc)", "")
    .replaceAll("(JAPAN)", "")

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
  )
}

function downloadAllGames(list) {
  let urlArr = [];
  list.games.forEach((item) => {
    urlArr.push(item);
  });
  dl.downloadFiles(urlArr);
}

function getCollectionByUrl(url) {
  return got(url)
    .then((response) => {
      return new JSDOM(response.body)
    })
    .then((dom) => {
      let elements = dom.window.document.querySelectorAll(
        QUERY_SELECTOR_ARCHIVES
      )
      return elements
    })
    .then((elements) => {
      let collection = { games: [] };
      elements.forEach((item) => {
        collection.games.push({
          name: item.textContent,
          keywords: simplify(item.textContent),
          url: URL_ARCHIVES + '/' + item.href,
        })
      })
      return collection
    })
    .catch((err) => {
      console.error(err)
    })
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
  let promises = [];

  for (let index = 1; index < ARCHIVES_SIZE + 1; index++) {
    index == 1
      ? promises.push(getCollectionByUrl(URL_ARCHIVES + "/"))
      : promises.push(getCollectionByUrl(URL_ARCHIVES + `.p${index}/`));
  }
  return Promise.all(promises).then((collections) => {
    let completeCollection = { games: [] };

    collections.forEach((item) =>
      item.games.forEach((x) => completeCollection.games.push(x))
    );
    return completeCollection
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
    found = false
    for (let indexArch = 0; indexArch < archives.games.length; indexArch++) {
      let archiveGame = archives.games[indexArch]
      let achievementGame = achievements.games[indexCheevo]

      if(!found) {
        if (indexArch == archives.games.length - 1 && !found) {
          console.log(
            "Jogo não encontrado:",
            achievementGame.name
          );
          missList.games.push(achievementGame);
        }
  
        if (
          achievementGame.keywords ==
          archiveGame.keywords
        ) {
          matchList.games.push(archiveGame);
          if(!archiveGame.name.toUpperCase().includes('DISC')) {
            found = true
          }
        }
      }
    }
  }

  console.log("\n");
  console.log("---------------")
  console.log("Jogos Encontrados: " + matchList.games.length)
  console.log("---------------")
  console.log("Jogos Não Encontrados: " + missList.games.length)
  console.log("\n");

  downloadAllGames(matchList)
}

const dl = new Downloader() 
Promise.all([loadAchievements(), loadArchives()]).then((x) => {
  doMissAndMatch(x);
});
