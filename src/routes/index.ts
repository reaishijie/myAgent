import { Hono } from 'hono'
import { adminMiddleware, authMiddleware } from '../middleware/auth.middleware'
import authApp from './auth.route'
import { adminConfigApp, configApp } from './config.route'
import conversationApp from './conversation.route'
import conversationGroupApp from './conversationGroup.route'
import modelApp from './model.route'
import modelChannelApp from './modelChannel.route'
import modelChannelBindingApp from './modelChannelBinding.route'
import modelPriceApp from './modelPrice.route'
import skillApp from './skill.route'
import userDefaultSkillApp from './userDefaultSkill.route'
import userApp from './user.route'
import userSkillApp from './userSkill.route'

const apiRouter = new Hono()
const adminRouter = new Hono()

apiRouter.route('/auth', authApp)
apiRouter.route('/configs', configApp)
apiRouter.route('/conversation-groups', conversationGroupApp)
apiRouter.route('/conversations', conversationApp)
apiRouter.route('/users', userApp)
apiRouter.route('/user-default-skills', userDefaultSkillApp)
apiRouter.route('/user-skills', userSkillApp)

adminRouter.use('*', authMiddleware(), adminMiddleware())
adminRouter.route('/configs', adminConfigApp)
adminRouter.route('/model-channels', modelChannelApp)
adminRouter.route('/models', modelApp)
adminRouter.route('/model-channel-bindings', modelChannelBindingApp)
adminRouter.route('/model-prices', modelPriceApp)
adminRouter.route('/skills', skillApp)

apiRouter.route('/admin', adminRouter)

export default apiRouter
