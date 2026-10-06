---
'@eve-online-tools/eve-ship-tree': minor
---

Ship group nodes show a tooltip on hover and keyboard focus: group icon, name, element glyphs and description. Locked groups list the skills required to unlock them; unlocked groups list their bonus skills with a training hint. Each skill shows the character's level, the level in training, Omega restrictions and whether the requirement is met. `TreeDisplay`'s `groupTooltip` turns it off or replaces its content. `SkillsProvider` and `ShipTree.Root` accept an optional `training` skill. New generated `skills.jsonl` table holds skill names.
