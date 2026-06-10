import { NotFoundException } from '../core/exceptions'

type Delegate = {
  findMany(args?: any): Promise<any[]>
  findFirst(args?: any): Promise<any | null>
  create(args: any): Promise<any>
  update(args: any): Promise<any>
}

const withActiveRecord = (where: Record<string, unknown> = {}) => ({
  ...where,
  deletedAt: null,
})

export const createCrudService = (delegateFactory: () => Delegate, name: string) => ({
  list(where: Record<string, unknown> = {}) {
    return delegateFactory().findMany({
      where: withActiveRecord(where),
      orderBy: { id: 'desc' },
    })
  },

  async get(id: number) {
    const record = await delegateFactory().findFirst({
      where: withActiveRecord({ id }),
    })

    if (!record) {
      throw new NotFoundException(`${name} not found`, `${name.toUpperCase()}_NOT_FOUND`)
    }

    return record
  },

  create(data: Record<string, unknown>) {
    return delegateFactory().create({ data })
  },

  async update(id: number, data: Record<string, unknown>) {
    await this.get(id)

    return delegateFactory().update({
      where: { id },
      data,
    })
  },

  async softDelete(id: number) {
    await this.get(id)

    return delegateFactory().update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },
})
