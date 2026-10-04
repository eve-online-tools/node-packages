---
'@eve-online-tools/eve-ship-tree': minor
---

`DataProvider` and `ShipTree.Root` take `PreloadedData`: only the seven tables the tree reads are required. `shipSizes` is now typed. The README documents each table's shape and SDE derivation. `useData().data` is typed as `PreloadedData`.
