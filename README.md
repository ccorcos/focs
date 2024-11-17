# Tools for the Fair Oaks Civic Society

https://platform.openai.com/usage
https://console.anthropic.com/settings/usage

## Download, Process, Summarize

```sh
src/all-download
src/all-process
src/all-summarize

find docs/SCOE  -type f -name "summary.md" | sort | xargs cat
```

Inside `src/process` and `src/summarize-meetings` we filter for 2024 which we'll want to update periodically.

### Todo

- SMUD has some image 175 that 500s for OpenAI.
- SCOE has the minutes for previous meetings in future meetings which garbles up the summaries.


Sometime, it might make sense to download committee meetings
- Bond oversight: https://www.forpd.org/agendacenter
- https://www.sanjuan.edu/connect/committees
- https://metrofire.ca.gov/finance-and-audit-committee
- https://metrofire.ca.gov/policyx-committee
- https://metrofire.ca.gov/executive-committee
- https://www.sjwd.org/committees

## Debugging

### `git push`

Git wont take a commit more than 2GB.

Size of files to push.

```sh
git status --untracked-files=all --porcelain | grep '??' | cut -c4- | \
xargs -I{} stat -f "%z %N" {} | awk '{s+=$1} END {print s}' | numfmt --to=iec
```

Get the first 500MB and git add.

```sh
git status --untracked-files=all --porcelain | grep '??' | cut -c4- | \
xargs -I{} stat -f "%z %N" {} | \
awk -v chunk_size=$((500*1024*1024)) '
{
  size=$1;
  file=$2;
  if (current_size + size > chunk_size) {
    exit; # Stop once the first group is complete
  }
  current_size += size;
  print file;
}' | xargs git add
```


Push commits one at a time.
```sh
> git log origin/master..HEAD --oneline
451df28 (HEAD -> master) Notes
694f941 SMFD part 6
3a6e695 SMFD part 5
a129037 SMFD part 4
1c79e29 SMFD part 3
03693a6 SMFD part 2
7f4b4a2 SMFD part 1
> git push origin 7f4b4a2:refs/heads/master
> git push origin 03693a6:refs/heads/master
> git push origin 1c79e29:refs/heads/master
> git push origin a129037:refs/heads/master
> git push origin 3a6e695:refs/heads/master
> git push origin 694f941:refs/heads/master
```


# SCOE fix minutes

```sh
# Find all board minutes files and move them to matching date folders
find docs/SCOE -type f -name "[0-9][0-9].[0-9][0-9].[0-9][0-9]*Minutes*" | while read file; do
  # Extract MM.DD.YY from filename
  filename=$(basename "$file")
  if [[ $filename =~ ([0-9]{2})\.([0-9]{2})\.([0-9]{2}) ]]; then
    month=${filename:0:2}
    day=${filename:3:2}
    year=${filename:6:2}

    # Convert to 20YY-MM-DD format for directory matching
    target_date="20${year}-${month}-${day}"

    # Find matching directory
    target_dir=$(find docs/SCOE -type d -name "${target_date}-*" | head -n 1)

    if [ -n "$target_dir" ]; then
      mv -f "$file" "$target_dir/"
      echo "Moved $filename to $target_dir"
    else
      echo "No matching directory found for $filename"
    fi
  fi
done
```