//////////// VARIABLES ////////////
replayPath = "io/input/";
outputPath = "io/output/combos.json"
characterNames = ["Falco"];
characterColors = ["Red"];
percentThreshold = 50
ignoreNonKill = false;
allowDoubles = false;
outputJsonIndentation = 4;
//////////// CONSTANTS ////////////
HUMAN_PLAYER_TYPE = 0
REPLAY_FILE_EXTENSION = ".slp"
STARTING_TIME_PAD = 4
ENDING_TIME_PAD = 3.5
FPS = 60
///////////////////////////////////
STARTING_FRAMES_BUFFER = FPS * STARTING_TIME_PAD
ENDING_FRAMES_BUFFER = FPS * ENDING_TIME_PAD

const { SlippiGame, characters } = require('slp-parser-js');  // npm install slp-parser-js
const fs = require("fs");
const path = require("path");

function traverseReplayPath(replayPath) {
    paths = []
    fs.readdirSync(replayPath).forEach(file => {
        let fullPath = path.join(replayPath, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            paths = paths.concat(traverseReplayPath(fullPath));
        } else {
            paths.push(fullPath)
        }
    });
    return paths.filter(path => path.endsWith(REPLAY_FILE_EXTENSION));
}

function findCharacterDetails(characterNames, characterColors) {
    filteredCharacters = characters.getAllCharacters()
        .filter(char => characterNames.includes(char.name) || characterNames.includes(char.shortName));
    characterIds = filteredCharacters
        .map(char => char.id);
    characterColorIds = filteredCharacters
        .flatMap(char => characterColors
            .map(charColor => char.colors.indexOf(charColor)));
    return {
        characterIds: characterIds,
        characterColorIds: characterColorIds
    }
}

function findPlayerIndexes(players, characterIds, characterColorIds) {
    return players
        .filter(player => characterIds === [] || characterIds.includes(player.characterId))
        .filter(player => characterColorIds === [] || characterColorIds.includes(player.characterColor))
        .map(player => player.playerIndex);
}

function filterCombos(combos, playerIndexes, percentThreshold, ignoreNonKill) {
    return combos
        .filter(combo => playerIndexes.includes(combo.playerIndex))
        .filter(combo => (combo.endPercent - combo.startPercent) >= percentThreshold)
        .filter(combo => !(ignoreNonKill) || combo.didKill);
}

function formDoplhinQueueElements(game, combos) {
    settings = game.getSettings();
    metadata = game.getMetadata();
    if (settings === null || metadata === null) {
        console.log(">> File with corrupt metadata ignored!");
        return [];
    }
    return combos.map(combo => {
        return {
            path: game.input.filePath,
            startFrame: combo.startFrame - STARTING_FRAMES_BUFFER > -123 ? combo.startFrame - STARTING_FRAMES_BUFFER : -123,
            endFrame: combo.endFrame + ENDING_FRAMES_BUFFER < metadata.lastFrame ? combo.endFrame + ENDING_FRAMES_BUFFER : metadata.lastFrame,
            additional: {
                playerCharacterName: characters.getCharacterInfo(settings.players.find(player => player.playerIndex === combo.playerIndex).characterId).name,
                opponentCharacterName: characters.getCharacterInfo(settings.players.find(player => player.playerIndex === combo.opponentIndex).characterId).name,
                damageDealt: combo.endPercent - combo.startPercent,
                didKill: combo.didKill
            }
        }
    });
}

absoluteReplayPath = path.resolve(replayPath)
replayPaths = traverseReplayPath(absoluteReplayPath);

dolphinQueue = []
for (i = 0; i < replayPaths.length; i ++) {
    console.log(`Progress: ${i + 1}/${replayPaths.length}\tCombos found: ${dolphinQueue.length}\tCurrent file: ${replayPaths[i]}`)
    game = new SlippiGame(replayPaths[i])
    if (!(allowDoubles || !(game.getSettings().isTeams))) {
        console.log(">> File with doubles ignored!");
        continue;
    }
    if (!(game.getSettings().players.every(player => player.type === HUMAN_PLAYER_TYPE))) {
        console.log(">> File with CPU ignored!");
        continue;
    }
    combos = game.getStats().combos;
    players = game.getSettings().players;
    characterDetails = findCharacterDetails(characterNames, characterColors)
    playerIndexes = findPlayerIndexes(players, characterDetails.characterIds, characterDetails.characterColorIds);
    filteredCombos = filterCombos(combos, playerIndexes, percentThreshold, ignoreNonKill);
    dolphinQueueElements = formDoplhinQueueElements(game, filteredCombos)
    dolphinQueue = dolphinQueue.concat(dolphinQueueElements);
}

dolphinJSON = {
  "mode": "queue",
  "replay": "",
  "isRealTimeMode": false,
  "outputOverlayFiles": true,
  "queue": dolphinQueue
};

absoluteOutputPath = path.resolve(outputPath)
fs.writeFileSync(absoluteOutputPath, JSON.stringify(dolphinJSON, null, outputJsonIndentation));

console.log(`Replay files found: ${replayPaths.length}`);
console.log(`Filtered combos found: ${dolphinQueue.length}`);
console.log(`Output file successfully written to: ${absoluteOutputPath}`);

/* References:
    https://github.com/project-slippi/slp-parser-js/blob/master/src/melee/characters.ts
    https://gist.github.com/NikhilNarayana/d45e328e9ea47127634f2faf575e8dcf
    https://video.stackexchange.com/questions/16564/how-to-trim-out-black-frames-with-ffmpeg-on-windows
Dump:
    const repl = require("repl"); var r = repl.start("node> ");

    function filterGames(games, allowDoubles) {
        return games
            .filter(game => allowDoubles || !(game.getSettings().isTeams))
                .filter(game => game.getSettings().players
                    .every(player => player.type === HUMAN_PLAYER_TYPE))
    }
    // games = replayPaths.map(path => new SlippiGame(path))
    // filteredGames = filterGames(games, allowDoubles)
    // dolphinQueue = filteredGames.map(game => {

    dolphinQueue = replayPaths
        .map(path => new SlippiGame(path))
        .filter(game => allowDoubles || !(game.getSettings().isTeams))
        .filter(game => game.getSettings().players.every(player => player.type === HUMAN_PLAYER_TYPE))   
        .map(game => {
            console.log(`Searching in file: ${game.input.filePath}`)
            combos = game.getStats().combos;
            players = game.getSettings().players;
            characterDetails = findCharacterDetails(characterNames, characterColors)
            playerIndexes = findPlayerIndexes(players, characterDetails.characterIds, characterDetails.characterColorIds);
            filteredCombos = filterCombos(combos, playerIndexes, percentThreshold, ignoreNonKill);
            dolphinQueueElements = formDoplhinQueueElements(game, filteredCombos)
            return dolphinQueueElements;
        }).flatMap(_ => _);

"C:\Users\guzma\AppData\Roaming\Slippi Desktop App\dolphin\Dolphin.exe" -i "C:\Users\guzma\Repositories\eowscript\io\output\combos.json"
*/
