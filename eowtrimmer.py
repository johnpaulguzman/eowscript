import json
import datetime
import subprocess as sp
import time
import shlex
import os

config_path = "config.json"
with open(config_path, 'rb') as f:
    config = json.load(f)

video_path = config['video_path']
write_concat_video = config['write_concat_video']
encoding_params = config['encoding_params']

parse_bytes = lambda b: b.decode('utf-8', errors='ignore')
remove_quotes = lambda s: s.replace('"', '')
win_shlex_split = lambda c: map(remove_quotes, shlex.split(c, posix=False))
def run_command(command):
    print(f">> Running command:\n{command}\n<< End of command <<")
    args = win_shlex_split(command)
    process = sp.Popen(args, stdout=sp.PIPE, stderr=sp.PIPE, shell=True)
    start_time = time.time()
    (out, err, rc, duration) = (*process.communicate(), process.returncode, time.time() - start_time)
    assert rc == 0, parse_bytes(err)
    result = {'command': command, 'stdout': out, 'stderr': err, 'returncode': rc, 'duration': duration}
    print(f">> Output:\n{parse_bytes(out)}\n<< End of output <<")
    return result

generate_input_cmd_tmpl = """ ffmpeg 
        -i "{}/Frames/framedump0.avi" 
        -i "{}/Audio/dspdump.wav" 
        -c copy 
        "{}" """
if not os.path.exists(video_path):
    print("Creating input file: {}".format(video_path))
    input_dir = os.path.dirname(video_path)
    generate_input_cmd = generate_input_cmd_tmpl.format(input_dir, input_dir, video_path)
    run_command(generate_input_cmd)

format_movie_path = lambda s: s.replace("\\", "/").replace(":", "\\\\:")
black_detect_cmd_tmpl = """ ffprobe 
    -f lavfi 
    -i "movie={},blackdetect[out0]" 
    -show_entries tags=lavfi.black_start,lavfi.black_end 
    -of default=nw=1 """
black_detect_cmd = black_detect_cmd_tmpl.format(format_movie_path(video_path))
black_detect_result = parse_bytes(run_command(black_detect_cmd)['stdout'])

ordered_remove_duplicates = lambda l: list(dict.fromkeys(l))
get_black_detect_time = lambda s: s[s.index('=') + 1: ]
zip_list_pairs = lambda l: zip(l[::2], l[1::2])

data = black_detect_result.split()
data = ordered_remove_duplicates(data)
data = data[1: ]  # remove the first start detection
data = list(map(get_black_detect_time, data))
data_pairs = list(zip_list_pairs(data))

extract_clip_cmd_tmpl = """ ffmpeg -y -i "{}" -ss {} -to {} {} "{}" """  # https://superuser.com/questions/377343/cut-part-from-video-file-from-start-position-to-end-position-with-ffmpeg
sec_to_timestamp = lambda s: str(datetime.timedelta(seconds=float(s))).replace(":", ";")
format_output_path = lambda p, t: os.path.join(os.path.dirname(p), ("trimmed" if t is None else sec_to_timestamp(t)) + "_" + os.path.basename(p))
format_concat_path = lambda p: os.path.join(os.path.dirname(p), "concat.txt")

concat_list = format_concat_path(video_path)
if os.path.exists(concat_list):
    os.remove(concat_list)

output_paths = []
for data_pair in data_pairs:
    output_path = format_output_path(video_path, data_pair[0])
    extract_clip_cmd = extract_clip_cmd_tmpl.format(video_path, data_pair[0], data_pair[1], encoding_params, output_path)
    run_command(extract_clip_cmd)
    output_paths += [output_path]

if write_concat_video:
    with open(concat_list, 'w') as f:
        for output_path in output_paths:
            f.write("file '{}'\n".format(output_path))
    merge_output_path = format_output_path(video_path, None)
    merge_clips_cmd_tmp = """ ffmpeg -y -f concat -safe 0 -i "{}" -c copy "{}" """
    merge_clips_cmd = merge_clips_cmd_tmp.format(concat_list, merge_output_path)
    run_command(merge_clips_cmd)
    print(f"File written to: {merge_output_path}")
