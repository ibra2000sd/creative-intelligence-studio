# Skills, agents and the hook

## Skills

Each skill is a directory under `plugin/skills/` with a `SKILL.md` of 55 to 75 lines in the same ten sections (purpose, when to use, inputs, workflow, tools, output contract, quality checks, failure handling, example, tests) and, where useful, reference files that are read only when needed. A test checks that structure, that every command a skill mentions exists, and that every file it links to exists.

| Skill | Use it for | Main commands | Produces |
|---|---|---|---|
| `creative-studio` | a whole project, or resuming one | `init`, `plan`, `status`, `task`, `approve` | plan, ledger |
| `intake-discovery` | turning client words into a brief | `brief` | `brief.json` |
| `research-evidence` | sourced findings | `research` | `research.json` |
| `art-direction` | two or three distinct directions | `directions` | direction files, board |
| `experience-dna` | the design language and tokens | `dna` | DNA, tokens |
| `brand-identity` | logo system, icons, applications, guidelines | `brand` | `brand/` |
| `image-asset-factory` | real image assets with provenance | `images` | `assets/generated/`, registry |
| `web-experience` | marketing website | `website`, `test web` | `web/` |
| `web-application` | dashboard or portal | `website --kind app`, `test app` | `app/` |
| `mobile-experience` | iOS and Android app | `mobile`, `test mobile` | `mobile/` |
| `motion-intelligence` | whether and how to animate | `motion` | `motion-spec.json` |
| `3d-experience` | interactive 3D product scene | `3d`, `test scene` | `scene/` |
| `design-to-code` | building from a reference image | `d2c` | diff report, heatmap |
| `quality-assurance` | tests, audit, repair loop | `test`, `audit`, `checkpoint` | reports |
| `creative-review` | independent critique | `review` | `creative-review.json` |
| `revision-management` | scoped client changes | `revise` | revision records |
| `delivery` | the hand-over package | `export` | archive, manifest |

`creative-studio route "<request>"` prints which skills a plain-language request maps to. It is a deterministic baseline used by the evaluation tests; in a session Claude selects skills from their descriptions.

## Agents

| Agent | Tools | Role |
|---|---|---|
| `creative-reviewer` | Read, Glob, Grep, Bash | Reviews finished work without the author's reasoning and writes the creative review. It cannot edit deliverables. |
| `source-auditor` | Read, Glob, Grep | Audits third-party skills, repositories and assets before anything is adopted. It cannot run code. |

## Hook

`hooks/hooks.json` registers one `PreToolUse` hook on the Bash tool. `upload-guard.mjs` does nothing unless the working directory is inside a CIS project. There, a command that would send local files to another host (curl or wget uploads, scp, rsync, cloud storage copies, gist creation) is denied when the brief says `deny`, and put to the user when it says `ask` or when the destination cannot be identified. It is a guard rail against accidents, not a sandbox.

## Model Context Protocol

The plugin registers no MCP server. Its state is plain files and its capabilities are a CLI, which Claude Code already drives through Bash, so an MCP layer would add a running process and tool definitions to every session without adding capability. Projects can still use MCP servers the user has connected:

- a browser or Playwright MCP server for exploratory checks alongside `creative-studio test`;
- a design-tool MCP server (for example Figma) as the *source* of a reference frame for `design-to-code`, when the user has authorised it;
- issue trackers or chat for sharing reports.

Anything fetched through them is untrusted data, and anything sent through them is subject to the brief's upload policy.
