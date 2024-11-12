# Tools for the Fair Oaks Civic Society


## Download Board Meeting Files

```sh

src/all-download

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


```sh
src/all-process

src/process docs/FORPD work/FORPD
src/process docs/SMUD work/SMUD
src/process docs/SJUSD work/SJUSD
src/process docs/SMFD work/SMFD
src/process docs/FOWD work/FOWD
src/process docs/LRCCD work/LRCCD
src/process docs/SJWD work/SJWD
src/process docs/SCOE work/SCOE
```

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

### `gs` not working

Cleanup bad files

```sh
find docs/SCOE  -type f -name "*.md"  -delete
```

Issue with draft transparency maybe.
```sh
/opt/homebrew/bin/gs \
  -dNOPAUSE \
  -dBATCH \
  -r400 \
  -sDEVICE=png16m \
  -dBackgroundColor=16\#FFFFFF \
  -sOutputFile="png/%04d.png" \
  "06.11.22%20CC%20Minutes%20UNAPPROVED%20for%20Agenda.pdf"
```
Simpliofy
```sh
/opt/homebrew/bin/gs -o simplified.pdf -sDEVICE=pdfwrite -dPDFSETTINGS=/printer "06.11.22%20CC%20Minutes%20UNAPPROVED%20for%20Agenda.pdf"
```

Need to simplify the pdf first:

```sh
 /opt/homebrew/bin/gs \
	-o simplified.pdf \
	-sDEVICE=pdfwrite \
	-dPDFSETTINGS=/printer \
	docs/SCOE/2023-02-25/PCOE%20and%20SCOE%20Sufficiency%20Letters.pdf

/opt/homebrew/bin/gs \
  -dNOPAUSE \
  -dBATCH \
  -r400 \
  -sDEVICE=png16m \
  -dBackgroundColor=16\#FFFFFF \
  -sOutputFile="png/%04d.png" \
  "simplified.pdf"
```

Here's a script to simplify all of them:
```sh
./src/simplify docs/SCOE docs/SCOE-simplified
```

