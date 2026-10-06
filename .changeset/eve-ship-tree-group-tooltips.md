---
'@eve-online-tools/eve-ship-tree': minor
---

Ship group nodes show a tooltip on hover and keyboard focus: group icon, name, element glyphs, description, the faction's bonus skills with the character's level and the level in training, and a training hint. `TreeDisplay`'s `groupTooltip` turns it off or replaces its content. `SkillsProvider` and `ShipTree.Root` accept an optional `training` skill. New generated `skills.jsonl` table holds skill names.
