Run a command once per organization, in parallel, using separate subagents.

Usage: /each <command and arguments>

Example: `/each /research summarize the last 12 months`

The user's input is: $ARGUMENTS

## Instructions

Parse the first token as the slash command name. Everything after it is the argument template.

Launch **8 parallel agents** (using the Agent tool), one for each organization below. Each agent should execute the slash command (via the Skill tool) with the org's full name and abbreviation prepended to the arguments.

For example, if the input is `/research summarize the last 12 months`, launch 8 agents where each one runs:
- `/research summarize the last 12 months for Fair Oaks Recreation and Park District (FORPD)`
- `/research summarize the last 12 months for Fair Oaks Water District (FOWD)`
- etc.

## Organizations

| Abbrev | Full Name |
|---|---|
| FORPD | Fair Oaks Recreation and Park District |
| FOWD | Fair Oaks Water District |
| SMUD | Sacramento Municipal Utility District |
| SMFD | Sacramento Metropolitan Fire District |
| SJUSD | San Juan Unified School District |
| LRCCD | Los Rios Community College District |
| SJWD | San Juan Water District |
| SCOE | Sacramento County Office of Education |

## Requirements

- All 8 agents MUST be launched in a single message (parallel, not sequential)
- Each agent runs independently with its own context
- Each agent should save its output to its own file (per the inner command's conventions)
- After all agents complete, provide a brief summary of results with links to the output files
