const { SlippiGame, characters, stages } = require('slp-parser-js');  // npm install slp-parser-js
const fs = require("fs");
const path = require("path");

config_path = "config.json";
var config = JSON.parse(fs.readFileSync(config_path, 'utf8'));

//////////// VARIABLES ////////////
replayPath = config.replayPath;
outputPath = config.outputPath;
characterNames = config.characterNames;
characterColors = config.characterColors;
percentThreshold = config.percentThreshold;
ignoreNonKill = config.ignoreNonKill;
allowDoubles = config.allowDoubles;
outputJsonIndentation = config.outputJsonIndentation;
maxClipsPerJson = config.maxClipsPerJson;
starting_time_pad = config.starting_time_pad;
ending_time_pad = config.ending_time_pad;
//////////// CONSTANTS ////////////
HUMAN_PLAYER_TYPE = 0;
REPLAY_FILE_EXTENSION = ".slp";
FPS = 60;
///////////////////////////////////
STARTING_FRAMES_BUFFER = FPS * starting_time_pad;
ENDING_FRAMES_BUFFER = FPS * ending_time_pad;

function traverseReplayPath(replayPath) {
    paths = [];
    fs.readdirSync(replayPath).forEach(file => {
        let fullPath = path.join(replayPath, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            paths = paths.concat(traverseReplayPath(fullPath));
        } else {
            paths.push(fullPath);
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
        .filter(player => characterIds.length === 0 || characterIds.includes(player.characterId))
        .filter(player => characterColorIds.length === 0 || characterColorIds.includes(player.characterColor))
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
        queueElement = {
            path: game.input.filePath,
            startFrame: combo.startFrame - STARTING_FRAMES_BUFFER > -123 ? combo.startFrame - STARTING_FRAMES_BUFFER : -123,
            endFrame: combo.endFrame + ENDING_FRAMES_BUFFER < metadata.lastFrame ? combo.endFrame + ENDING_FRAMES_BUFFER : metadata.lastFrame,
            additional: {
                playerCharacterName: characters.getCharacterInfo(settings.players.find(player => player.playerIndex === combo.playerIndex).characterId).name,
                opponentCharacterName: characters.getCharacterInfo(settings.players.find(player => player.playerIndex === combo.opponentIndex).characterId).name,
                stage: stages.getStageName(settings.stageId),
                startPercent: combo.startPercent,
                endPercent: combo.endPercent,
                damageDealt: combo.endPercent - combo.startPercent,
                didKill: combo.didKill
            }
        };
        return queueElement;
    });
}

function swapConsecutivePathsInPlace(l) {
    didSwap = false;
    for (i = 0; i < l.length - 1; i++) {
        if (l[i].path === l[i + 1].path) {
            didSwap = true;
            a = i + 1;
            b = (a + 1) % l.length;
            [ l[a], l[b] ] = [ l[b], l[a] ];
        }
    }
    if (didSwap) {
        swapConsecutivePathsInPlace(l);
    }
}

function addIndexesInPlace(l) {
    for (i = 0; i < l.length; i++) {
        l[i].additional.index = i % maxClipsPerJson + 1;
    }
}

absoluteReplayPath = path.resolve(replayPath);
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

swapConsecutivePathsInPlace(dolphinQueue);
addIndexesInPlace(dolphinQueue);
console.log(`Replay files found: ${replayPaths.length}`);
console.log(`Filtered combos found: ${dolphinQueue.length}`);

chunkSplit = (stream, size) => stream.reduce((chunks, item, idx, arr) => (idx % size == 0) ? [...chunks, arr.slice(idx, idx + size)] : chunks, []);
dolphinQueueChunks = chunkSplit(dolphinQueue, maxClipsPerJson);
for (i = 0; i < dolphinQueueChunks.length; i++) {
    chunk = dolphinQueueChunks[i];
    chunkOutputPath = outputPath + "_" + i;
    dolphinJSON = {
        "mode": "queue",
        "replay": "",
        "isRealTimeMode": false,
        "outputOverlayFiles": true,
        "queue": chunk
    };
    absoluteChunkOutputPath = path.resolve(chunkOutputPath);
    fs.writeFileSync(absoluteChunkOutputPath, JSON.stringify(dolphinJSON, null, outputJsonIndentation));
    console.log(`Output file successfully written to: ${absoluteChunkOutputPath}`);
}

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

*/
