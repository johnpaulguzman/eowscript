# eowscript

## Install dependencies (version 1: the scrub way)
- Install node + npm: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
    - Open Command Prompt and run: `npm install -g slp-parser-js`
- Install python: [https://www.python.org/downloads/](https://www.python.org/downloads/)
    - Check the `Add Python to environment variables` option during installation
- Install ffmpeg: [https://ffmpeg.zeranoe.com/builds/](https://ffmpeg.zeranoe.com/builds/)
    - Extract the ffmpeg archive
    - Copy the path for the `bin` folder
    - In the start menu, type `variables`, click `Edit the system environment variables`
    - Environment Variables > User variables for ... > Path > Edit > New > paste the path
    - Okkokokokokokokokkokokokkokokokokokokokokoko

## Install dependencies (version 2: via [Chocolatey](https://chocolatey.org/install))
- Install everything by opening **Command Prompt as admin** and * **individually** * executing the following:

#

    @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
    choco install -y nodejs python ffmpeg
    npm install -g slp-parser-js

- Verify the installations in by running the following in Command Prompt:
    - `choco -v` : Chocolatey is a package manager. Here it's used to install nodejs, ffmpeg, and Python
    - `node -v` : Nodejs lets you run JavaScript code. The Slippi file parser used (slp-parser-js) is written in JavaScript
    - `python --version` : Python is the language used to automate the detection and trimming of black frames
    - `ffmpeg -version` : ffmpeg is the command-line tool used for editing video
    - `choco list --localonly` : Displays all packages handled by Chocolatey

## Usage (Combo Finder)
- Modify the variables in `config.json` and make sure your slippi files are inside `replayPath`
- Open Command Prompt and run: `node eowfinder.js`
- If it ran successfully, it should output the output JSON path
- Play and record the replays in Slippi Playback

## Usage (Slippi Playback)
- Run the command: `"<SLIPPI_PLAYBACK_DOLPHIN_PATH>" -i "<COMBO_FINDER_OUTPUT_JSON_PATH>"`
- Sample: `"C:\Users\guzma\AppData\Roaming\Slippi Desktop App\dolphin\Dolphin.exe" -i "C:\Users\guzma\Repositories\eowscript\io\output\combos.json_0"`

## Usage (Black Frame Trimmer)
- Modify the variables in `config.json` and make sure that the video path is matches `video_path`
- Open Command Prompt and run: `python eowtrimmer.py`
- If it ran successfully, it should output the output video path

### References for `encoding_params`:
- List the available ffmpeg codecs: `ffmpeg -codecs`
- Show the available parameters for an encoder: `ffmpeg -h encoder=<ENCODER>`
- [https://superuser.com/questions/1236275/how-can-i-use-crf-encoding-with-nvenc-in-ffmpeg](https://superuser.com/questions/1236275/how-can-i-use-crf-encoding-with-nvenc-in-ffmpeg)
- [https://slhck.info/video/2017/02/24/crf-guide.html](https://slhck.info/video/2017/02/24/crf-guide.html)

### ** Tips **
- A convenient way to open command prompt in a specific directory is to:
    - Open the directory in Windows Explorer
    - In the address bar (C:\\...) erase the contents, then type `cmd` and hit enter.
- Character input options: [https://github.com/project-slippi/slp-parser-js/blob/master/src/melee/characters.ts](https://github.com/project-slippi/slp-parser-js/blob/master/src/melee/characters.ts)
