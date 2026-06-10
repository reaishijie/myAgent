import { ConfigAccessLevel, RecordStatus, UserRole } from '@prisma/client'
import { getDb } from '../src/db'

const getArg = (name: string) => {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

const defaultConfigs = [
  {
    key: 'site.name',
    value: 'myAgent',
    group: 'site',
    accessLevel: ConfigAccessLevel.PUBLIC,
    description: 'Public site name',
  },
  {
    key: 'feature.chat.enabled',
    value: false,
    group: 'feature',
    accessLevel: ConfigAccessLevel.PUBLIC,
    description: 'Whether chat entrypoints are enabled',
  },
  {
    key: 'oss.endpoint',
    value: '',
    group: 'oss',
    accessLevel: ConfigAccessLevel.ADMIN,
    description: 'Object storage endpoint placeholder',
  },
]

const main = async () => {
  const db = getDb()
  const adminUsername = getArg('admin-username')
  const adminEmail = getArg('admin-email')

  if (adminUsername || adminEmail) {
    const user = await db.user.findFirst({
      where: {
        OR: [
          ...(adminUsername ? [{ username: adminUsername }] : []),
          ...(adminEmail ? [{ email: adminEmail }] : []),
        ],
      },
    })

    if (!user) {
      throw new Error('Admin user target was not found')
    }

    await db.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    })
  }

  for (const config of defaultConfigs) {
    await db.config.upsert({
      where: { key: config.key },
      create: {
        ...config,
        status: RecordStatus.ENABLED,
      },
      update: {
        group: config.group,
        accessLevel: config.accessLevel,
        description: config.description,
      },
    })
  }
}

main()
  .then(() => {
    console.log('Phase 1 initialization completed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

