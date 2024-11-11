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

```

- Los Rios Community College District
- San Juan Water District


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
