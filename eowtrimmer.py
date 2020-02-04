############ VARIABLES ############
input_path = "C:\\Users\\jguzman2\\OneDrive - Infor\\Desktop\\ohe\\out.mkv"
###################################

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
black_detect_cmd = f""" ffprobe 
    -f lavfi 
    -i "movie={format_movie_path(input_path)},blackdetect[out0]" 
    -show_entries tags=lavfi.black_start,lavfi.black_end 
    -of default=nw=1 """
black_detect_result = parse_bytes(run_command(black_detect_cmd)['stdout'])

ordered_remove_duplicates = lambda l: list(dict.fromkeys(l))
get_black_detect_time = lambda s: s[s.index('=') + 1: ]
zip_list_pairs = lambda l: zip(l[::2], l[1::2])
def format_segments(black_detect_result):
    data = black_detect_result.split()[1: ]
    data = list(map(get_black_detect_time, data))
    data_pairs = zip_list_pairs(data)
    segments = "+".join([f"between(t,{dp[0]},{dp[1]})" for dp in data_pairs])
    return segments

segments = format_segments(black_detect_result)
format_output_path = lambda s: os.path.join(os.path.dirname(input_path), "output_" + os.path.basename(input_path))
output_path = format_output_path(input_path)
select_segments_cmd = f""" ffmpeg -y
    -i "{input_path}" 
    -vf "select='{segments}',setpts=N/FRAME_RATE/TB" 
    -af "aselect='{segments}',asetpts=N/SR/TB" 
    "{output_path}" """

_ = run_command(select_segments_cmd)
print(f"File written to: {output_path}")
