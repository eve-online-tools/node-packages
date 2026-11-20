import type { SdeTable } from './sde'
import type { TableName } from './types'

declare const assetBrand: unique symbol

/** Placeholder for an emitted file inside a dataset value; consumers receive the file's URL in its place. */
export type DatasetAsset = { readonly [assetBrand]: true; readonly __eveSdeAsset: string }

/** What a consumer imports for a dataset value: assets become URL strings. */
export type Resolved<T> = T extends DatasetAsset
  ? string
  : T extends readonly (infer Item)[]
    ? Resolved<Item>[]
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T

/** Value a consumer imports for a dataset. */
export type DatasetValue<D> = D extends Dataset<infer Value, TableName, string> ? Resolved<Value> : unknown

export type DatasetContext<Tables extends TableName> = {
  release: { release: string; buildNumber: number; releaseDate: string }
  /** Only declared tables can be read, so the dataset fingerprint covers every input. */
  table: <T extends Tables>(name: T) => SdeTable<T>
  /** Value of a dataset listed in `dependsOn`. */
  dataset: <Value>(dependency: Dataset<Value>) => Value
  /** Emits a file with the build output; the returned placeholder resolves to its URL. */
  emit: (fileName: string, data: Uint8Array | string) => DatasetAsset
  /** Writes a file under the dataset's `outDir`, e.g. generated data committed to the repository. */
  write: (relativePath: string, data: Uint8Array | string) => Promise<void>
}

export type Dataset<Value = unknown, Tables extends TableName = TableName, Id extends string = string> = {
  /** Unique across all datasets of a build; packages should prefix it, e.g. `eve-map:map-data`. */
  id: Id
  /** Bump when `build` output changes for the same inputs. */
  version: string
  tables: readonly Tables[]
  dependsOn?: readonly Dataset<unknown, TableName>[]
  /** Directory for `write`, relative to the project root. `write` throws when unset. */
  outDir?: string
  build: (ctx: DatasetContext<Tables>) => Value | Promise<Value>
}

// `Id` comes first: with a context-sensitive `build`, TypeScript only keeps the literal id type for a leading `const`
// type parameter.
export const defineDataset = <const Id extends string, Value, Tables extends TableName>(
  dataset: Dataset<Value, Tables, Id>,
): Dataset<Value, Tables, Id> => dataset

export const isDatasetAsset = (value: unknown): value is DatasetAsset =>
  typeof value === 'object' && value !== null && typeof (value as DatasetAsset).__eveSdeAsset === 'string'

/** Replaces asset placeholders in a dataset value. */
export const resolveAssets = (value: unknown, replace: (fileName: string) => unknown): unknown => {
  if (isDatasetAsset(value)) {
    return replace(value.__eveSdeAsset)
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveAssets(item, replace))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssets(item, replace)]))
  }
  return value
}
