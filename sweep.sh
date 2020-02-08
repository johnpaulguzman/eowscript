#!/usr/bin/env bash
set -x
sweep_path="sweep"
dump_name="dump"
dump_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "${dump_path}"
echo "Enter folder prefix: "
read prefix
mkdir "${sweep_path}"
mkdir "${sweep_path}/${prefix}"
ls . | grep -E "${dump_name}.*\.avi" | xargs -I{} mv "{}" "${sweep_path}/${prefix}/{}"
