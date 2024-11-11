# Tools for the Fair Oaks Civic Society


## Download Board Meeting Files

```sh
# Fair Oaks Recreation and Park District
./src/forpd docs/FORPD

# Sacramento Municipal Utility District
npx tsx src/smud.ts docs/SMUD

# San Juan Unified School District
npx tsx src/sjusd.ts docs/SJUSD

# Sacramento Metropolitan Fire District
npx tsx src/smfd.ts docs/SMFD

# Fair Oaks Water District
npx tsx src/fowd.ts docs/FOWD

# Sacramento Board of Education
npx tsx src/scoe.ts docs/SCOE

# Los Rios Community College District
npx tsx src/lrccd.ts docs/LRCCD

# San Juan Water District
npx tsx src/sjwd.ts docs/SJWD
```

### Todo

Sometime, it might make sense to download committee meetings
- Bond oversight: https://www.forpd.org/agendacenter
- https://www.sanjuan.edu/connect/committees
- https://metrofire.ca.gov/finance-and-audit-committee
- https://metrofire.ca.gov/policyx-committee
- https://metrofire.ca.gov/executive-committee
- https://www.sjwd.org/committees


## Processing files



## Debugging

### `git push`

Git wont take a commit more than 2GB.

Size of files to push.

```sh
git status --untracked-files=all --porcelain | awk '/^\?\?/ {print $2}' | tr '\n' '\0' | xargs -0 stat -f%z | awk '{s+=$1} END {print s}' | numfmt --to=iec
```

Get the first 500MB and git add.

```sh
git status --untracked-files=all --porcelain | \
awk '/^\?\?/ {print $2}' | \
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

