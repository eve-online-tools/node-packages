export type ShipTreeGroupPreReqSkill = {
  _key: number
  display: boolean
  level: number
}

export type ShipTreeGroupRecord = {
  name?: { en?: string }
  preReqSkills?: Array<{
    _key: number
    skills: ShipTreeGroupPreReqSkill[]
  }>
}
