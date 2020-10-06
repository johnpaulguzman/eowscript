import json
import datetime
import os
import re
import subprocess
import time

config_path = "config.json"
with open(config_path, 'rb') as f:
    config = json.load(f)

min_duration = config['min_duration']
video_path = config['video_path']
encoding_params = config['encoding_params']
verbosity_params = config['verbosity_params']
tmp_dir = os.path.join(os.path.dirname(video_path), os.path.basename(video_path) + "_tmp")
output_dir = os.path.join(os.path.dirname(video_path), os.path.basename(video_path) + "_output")
os.makedirs(tmp_dir, exist_ok=True)
os.makedirs(output_dir, exist_ok=True)
assert " " not in video_path, "video_path must not contain any spaces."

def run_command(tmpl, *args):
    command = tmpl.format(*args)
    print(f">> Running command:\n{command}\n<< End of command <<\n\n")
    process = subprocess.check_output(command, shell=True)
    result = process.decode('utf-8', errors='ignore')
    if result.strip():
        print(f">> Output:\n{result}\n<< End of output <<\n\n")
    return result


def load_black_detect():
    black_detect_cache = os.path.join(tmp_dir, "black_detect_cache.txt")
    if os.path.exists(black_detect_cache):
        print(f"Using cached blackdetect output: {black_detect_cache}")
        with open(black_detect_cache, 'r') as file:
            black_detect_result = file.read()
    else:
        black_detect_cmd_tmpl = (
            'ffprobe '
            '-f lavfi '
            '-i "movie={},blackdetect[out0]" '
            '-show_entries tags=lavfi.black_start,lavfi.black_end '
            '-of default=nw=1'
        )
        movie_path = video_path.replace("\\", "/").replace(":", "\\\\:")
        black_detect_result = run_command(black_detect_cmd_tmpl, movie_path)
        with open(black_detect_cache, 'w', newline='') as file:
            file.write(black_detect_result)
    return black_detect_result


def parse_black_detect(black_detect_result):
    get_black_detect_time = lambda s: s[s.index('=') + 1 :]
    data = black_detect_result.split()
    data = list(dict.fromkeys(data))  # remove duplicates
    data = data[1:]  # remove the first start detection
    data = list(map(get_black_detect_time, data))  # parse string blackdetect tags output
    data_pairs = list(zip(data[::2], data[1::2]))  # form time range tuples
    return data_pairs


clip_cmd_tmpl = 'ffmpeg -y -ss {} -i "{}" -t {} -avoid_negative_ts 1 -c copy "{}" {}'
probe_tmp_duration_cmd_tmpl = 'ffprobe -i {} -show_format {}'
probe_duration_re = re.compile('duration=(\\d*\\.\\d*)')
trim_cmd_tmpl = 'ffmpeg -y -i "{}" -ss {} -t {} {} "{}" {}'
sec_to_timestamp = lambda sec: str(datetime.timedelta(seconds=float(sec))).replace(":", ";")
str_minus = lambda t1, t2: str(float(t1) - float(t2))


def trim_data_pair(data_pair):  # TODO: multiprocessing
    duration = str_minus(data_pair[1], data_pair[0])
    tmp_path = os.path.join(tmp_dir, sec_to_timestamp(data_pair[0]) + "_" + os.path.basename(video_path))
    output_path = os.path.join(output_dir, sec_to_timestamp(data_pair[0]) + "_" + os.path.basename(video_path))
    if float(duration) < min_duration:
        print(f"Skipping detected short file ({duration} < {min_duration} sec): {output_path}...")
    if os.path.exists(output_path):
        print(f"Skipping trimmed file: {output_path}...")
        return

    clip_cmd = clip_cmd_tmpl.format(data_pair[0], video_path, duration, tmp_path, verbosity_params)
    run_command(clip_cmd)

    probe_tmp_duration_cmd = probe_tmp_duration_cmd_tmpl.format(tmp_path, verbosity_params)
    probe_tmp_duration_output = run_command(probe_tmp_duration_cmd)
    probe_tmp_duration = probe_duration_re.search(probe_tmp_duration_output)
    tmp_duration = probe_tmp_duration.groups()[0]

    start_ts = str_minus(tmp_duration, duration)
    trim_cmd = trim_cmd_tmpl.format(tmp_path, start_ts, duration, encoding_params, output_path, verbosity_params)
    run_command(trim_cmd)


black_detect_result = load_black_detect()
data_pairs = parse_black_detect(black_detect_result)
for (idx, data_pair) in enumerate(data_pairs):
    print(f"Trimming clip: {idx}/{len(data_pairs)}...")
    trim_data_pair(data_pair)
print("SUCCESS")
