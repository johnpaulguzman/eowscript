############ VARIABLES ############
input_path = "C:\\Users\\guzma\\AppData\\Roaming\\Slippi Desktop App\\dolphin\\User\\Dump\\dump.avi"
concat_list = "C:\\Users\\guzma\\AppData\\Roaming\\Slippi Desktop App\\dolphin\\User\\Dump\\concat.txt"
###################################

import datetime
import subprocess as sp
import time
import shlex
import os

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

format_movie_path = lambda s: s.replace("\\", "/").replace(":", "\\\\:")
black_detect_cmd_tmpl = """ ffprobe 
    -f lavfi 
    -i "movie={},blackdetect[out0]" 
    -show_entries tags=lavfi.black_start,lavfi.black_end 
    -of default=nw=1 """
black_detect_cmd = black_detect_cmd_tmpl.format(format_movie_path(input_path))
black_detect_result = parse_bytes(run_command(black_detect_cmd)['stdout'])

ordered_remove_duplicates = lambda l: list(dict.fromkeys(l))
get_black_detect_time = lambda s: s[s.index('=') + 1: ]
zip_list_pairs = lambda l: zip(l[::2], l[1::2])

data = black_detect_result.split()
data = ordered_remove_duplicates(data)
data = data[1: ]  # remove the first start detection
data = list(map(get_black_detect_time, data))
data_pairs = list(zip_list_pairs(data))

extract_clip_cmd_tmpl = """ ffmpeg -y -i "{}" -ss {} -to {} -c copy "{}" """
sec_to_timestamp = lambda s: str(datetime.timedelta(seconds=s)).replace(":", ";")
format_output_path = lambda p, t: os.path.join(os.path.dirname(p), ("final" if t is None else sec_to_timestamp(t)) + "_" + os.path.basename(p))

sec = 0
if os.path.exists(concat_list):
    os.remove(concat_list)

for data_pair in data_pairs:
    output_path = format_output_path(input_path, sec)
    extract_clip_cmd = extract_clip_cmd_tmpl.format(input_path, data_pair[0], data_pair[1], output_path)
    run_command(extract_clip_cmd)
    with open(concat_list, 'a') as f:
        f.write("file '{}'\n".format(output_path))
    sec += float(data_pairs[0][1]) - float(data_pairs[0][0])

merge_output_path = format_output_path(input_path, None)
merge_clips_cmd_tmp = """ ffmpeg -y -f concat -safe 0 -i "{}" -c copy "{}" """
merge_clips_cmd = merge_clips_cmd_tmp.format(concat_list, merge_output_path)
run_command(merge_clips_cmd)

print(f"File written to: {merge_output_path}")



#import code; code.interact(local={**locals(), **globals()})
#def format_segments(black_detect_result):  # TODO USE: https://markheath.net/post/cut-and-concatenate-with-ffmpeg TO PRESERVE -c copy \
#    data = black_detect_result.split()
#    data = ordered_remove_duplicates(data)
#    data = data[1: ]  # remove the first start detection
#    data = list(map(get_black_detect_time, data))
#    data_pairs = zip_list_pairs(data)
#    segments = "+".join([f"between(t,{dp[0]},{dp[1]})" for dp in data_pairs])
#    return segments
#
#segments = format_segments(black_detect_result)
#format_output_path = lambda s: os.path.join(os.path.dirname(input_path), "output_" + os.path.basename(input_path))
#output_path = format_output_path(input_path)
#select_segments_cmd = f""" ffmpeg -y
#    -i "{input_path}" 
#    -vf "select='{segments}',setpts=N/FRAME_RATE/TB" 
#    -af "aselect='{segments}',asetpts=N/SR/TB" 
#    "{output_path}" """
#
#_ = run_command(select_segments_cmd)
