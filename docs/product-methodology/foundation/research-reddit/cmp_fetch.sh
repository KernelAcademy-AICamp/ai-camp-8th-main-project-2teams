#!/bin/bash
# usage: cmp_fetch.sh <kind:submission|comment> <urlencoded_q> <outfile> [extra]
D=/private/tmp/claude-501/-Users-yujeong-Desktop---/7a2e1bfd-8fbb-4123-ab7a-feda31751bba/scratchpad
for i in 1 2 3 4 5; do
  curl -s --max-time 45 "https://api.pullpush.io/reddit/search/$1/?q=$2&size=100$4" -o "$D/$3"
  n=$(python3 -c "import json,sys;print(len(json.load(open('$D/$3'))['data']))" 2>/dev/null)
  if [ -n "$n" ]; then echo "$3 -> $n"; exit 0; fi
  sleep $((i*4))
done
echo "$3 -> FAIL"
