import { Hono } from 'hono'
import { adminMiddleware, authMiddleware } from '../middleware/auth.middleware'
import adminAssetsApp from './adminAssets.route'
import adminBillingRecordsApp from './adminBillingRecords.route'
import adminGenerationJobsApp from './adminGenerationJobs.route'
import adminModelInvocationsApp from './adminModelInvocations.route'
import assetApp from './asset.route'
import authApp from './auth.route'
import billingRecordApp from './billingRecord.route'
import { adminConfigApp, configApp } from './config.route'
import conversationApp from './conversation.route'
import conversationGroupApp from './conversationGroup.route'
import generationJobApp from './generationJob.route'
import modelApp from './model.route'
import modelChannelApp from './modelChannel.route'
import modelChannelBindingApp from './modelChannelBinding.route'
import modelInvocationApp from './modelInvocation.route'
import modelPriceApp from './modelPrice.route'
import pluginApp from './plugin.route'
import skillApp from './skill.route'
import userDefaultSkillApp from './userDefaultSkill.route'
import userApp from './user.route'
import userSkillApp from './userSkill.route'

const apiRouter = new Hono()
const adminRouter = new Hono()

apiRouter.route('/auth', authApp)
apiRouter.route('/assets', assetApp)
apiRouter.route('/billing-records', billingRecordApp)
apiRouter.route('/configs', configApp)
apiRouter.route('/conversation-groups', conversationGroupApp)
apiRouter.route('/conversations', conversationApp)
apiRouter.route('/generation-jobs', generationJobApp)
apiRouter.route('/model-invocations', modelInvocationApp)
apiRouter.route('/users', userApp)
apiRouter.route('/user-default-skills', userDefaultSkillApp)
apiRouter.route('/user-skills', userSkillApp)

adminRouter.use('*', authMiddleware(), adminMiddleware())
adminRouter.route('/configs', adminConfigApp)
adminRouter.route('/assets', adminAssetsApp)
adminRouter.route('/billing-records', adminBillingRecordsApp)
adminRouter.route('/generation-jobs', adminGenerationJobsApp)
adminRouter.route('/model-channels', modelChannelApp)
adminRouter.route('/models', modelApp)
adminRouter.route('/model-channel-bindings', modelChannelBindingApp)
adminRouter.route('/model-invocations', adminModelInvocationsApp)
adminRouter.route('/model-prices', modelPriceApp)
adminRouter.route('/plugins', pluginApp)
adminRouter.route('/skills', skillApp)

apiRouter.route('/admin', adminRouter)

export default apiRouter
