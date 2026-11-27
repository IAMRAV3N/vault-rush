#!/bin/bash
set -e
cd "$(dirname "$0")"
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONT_R=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
# Fix: drop the OPEN A PACK overlay title (the app's own gold button already says it)
# and move the step lines + tag into the empty bottom half of the crop, so nothing
# overlaps the app's Open pack button at the top.
mkseg() {
  local out=$1 img=$2 dur=$3 audio=$4 extra=$5
  ffmpeg -y -v error -loop 1 -framerate 30 -t "$dur" -i "$img" -i "$audio" \
    -filter_complex "[0:v]zoompan=z='min(1+0.00045*on,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p${extra}[v];[1:a]adelay=800|800,apad,atrim=0:${dur}[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -r 30 -c:a aac -b:a 128k -t "$dur" "$out"
}
DT3="drawtext=textfile=t_step31.txt:fontfile=$FONT:fontsize=34:fontcolor=white:x=90:y=780:box=1:boxcolor=0x000000@0.55:boxborderw=18:enable='between(t,1,16)',drawtext=textfile=t_step32.txt:fontfile=$FONT:fontsize=34:fontcolor=white:x=90:y=850:box=1:boxcolor=0x000000@0.55:boxborderw=18:enable='between(t,5,16)',drawtext=textfile=t_step33.txt:fontfile=$FONT:fontsize=38:fontcolor=#E9B949:x=90:y=920:box=1:boxcolor=0x000000@0.55:boxborderw=18:enable='between(t,9,16)',drawtext=textfile=t_tag3.txt:fontfile=$FONT:fontsize=26:fontcolor=#BFE3C6:x=90:y=1000:box=1:boxcolor=0x000000@0.55:boxborderw=16"
mkseg seg_v3.mp4 crop_packs.png 16 seg3.mp3 ",$DT3"
printf "file 'seg_v1.mp4'\nfile 'seg_v2.mp4'\nfile 'seg_v3.mp4'\nfile 'seg_v4.mp4'\nfile 'seg_v5.mp4'\nfile 'seg_v6.mp4'\n" > concat.txt
ffmpeg -y -v error -f concat -safe 0 -i concat.txt -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k ../vault-rush-walkthrough.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 ../vault-rush-walkthrough.mp4
echo SEG3_FIXED
