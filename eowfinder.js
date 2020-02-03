//////////// VARIABLES ////////////
replayPath = "io/input/";
outputPath = "io/output/combos.json"
characterNames = ["Falco"];
characterColors = ["Red"];
percentThreshold = 40
ignoreNonKill = false;
allowDoubles = false;
outputJsonIndentation = 4;
//////////// CONSTANTS ////////////
HUMAN_PLAYER_TYPE = 0
REPLAY_FILE_EXTENSION = ".slp"
///////////////////////////////////

const { SlippiGame, characters } = require('slp-parser-js');  // npm install slp-parser-js
const fs = require("fs");
const path = require("path");

function traverseReplayPath(replayPath) {
    paths = []
    fs.readdirSync(replayPath).forEach(file => {
        let fullPath = path.join(replayPath, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            paths = [...paths, ...traverseReplayPath(fullPath)];
        } else {
            paths = [...paths, fullPath]
        }
    });
    return paths.filter(path => path.endsWith(REPLAY_FILE_EXTENSION));
}

function filterGames(games, allowDoubles) {
    return games
        .filter(game => allowDoubles || !(game.getSettings().isTeams))
        .filter(game => game.getSettings().players
            .every(player => player.type === HUMAN_PLAYER_TYPE))
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
    return combos.map(combo => {
        settings = game.getSettings();
        metadata = game.getMetadata();
        return {
            path: game.input.filePath,
            startFrame: combo.startFrame - 240 > -123 ? combo.startFrame - 240 : -123,
            endFrame: combo.endFrame + 180 < metadata.lastFrame ? combo.endFrame + 180 : metadata.lastFrame,
            additional: {
                playerCharacterName: characters.getCharacterInfo(game.getSettings().players.find(player => player.playerIndex === combo.playerIndex).characterId).name,
                opponentCharacterName: characters.getCharacterInfo(game.getSettings().players.find(player => player.playerIndex === combo.opponentIndex).characterId).name,
                damageDealt: combo.endPercent - combo.startPercent,
                didKill: combo.didKill
            }
        }
    });
}

absoluteReplayPath = path.resolve(replayPath)
replayPaths = traverseReplayPath(absoluteReplayPath);
games = replayPaths.map(path => new SlippiGame(path))
filteredGames = filterGames(games, allowDoubles)

dolphinQueue = filteredGames.map(game => {
    combos = game.getStats().combos;
    players = game.getSettings().players;
    characterDetails = findCharacterDetails(characterNames, characterColors)
    playerIndexes = findPlayerIndexes(players, characterDetails.characterIds, characterDetails.characterColorIds);
    filteredCombos = filterCombos(combos, playerIndexes, percentThreshold, ignoreNonKill);
    dolphinQueueElements = formDoplhinQueueElements(game, filteredCombos)
    return dolphinQueueElements;
}).flatMap(_ => _);

dolphinJSON = {
  "mode": "queue",
  "replay": "",
  "isRealTimeMode": false,
  "outputOverlayFiles": true,
  "queue": dolphinQueue
};

absoluteReplayPath = path.resolve(outputPath)
fs.writeFileSync(absoluteReplayPath, JSON.stringify(dolphinJSON, null, outputJsonIndentation));

console.log(`Replay files found: ${replayPaths.length}`);
console.log(`Filtered combos found: ${dolphinQueue.length}`);
console.log(`Output file successfully written to: ${absoluteReplayPath}`);

/* References:
    https://github.com/project-slippi/slp-parser-js/blob/master/src/melee/characters.ts
    https://gist.github.com/NikhilNarayana/d45e328e9ea47127634f2faf575e8dcf
    https://video.stackexchange.com/questions/16564/how-to-trim-out-black-frames-with-ffmpeg-on-windows
const repl = require("repl"); var r = repl.start("node> ");
TODO: figure out ffmpeg
*/
