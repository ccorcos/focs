# Tools for the Fair Oaks Civic Society

https://platform.openai.com/usage
https://console.anthropic.com/settings/usage

## Download, Process, Summarize

```sh
src/all-download
src/all-process
src/all-summarize
```

Inside `src/process` and `src/summarize-meetings` we filter for 2024 which we'll want to update periodically.

### Todo

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
