import { Hono } from 'hono'
import { adminMiddleware, authMiddleware } from '../middleware/auth.middleware'
import authApp from './auth.route'
import { adminConfigApp, configApp } from './config.route'
import modelApp from './model.route'
import modelChannelApp from './modelChannel.route'
import modelChannelBindingApp from './modelChannelBinding.route'
import modelPriceApp from './modelPrice.route'
import userApp from './user.route'

const apiRouter = new Hono()
const adminRouter = new Hono()

apiRouter.route('/auth', authApp)
apiRouter.route('/configs', configApp)
apiRouter.route('/users', userApp)

adminRouter.use('*', authMiddleware(), adminMiddleware())
adminRouter.route('/configs', adminConfigApp)
adminRouter.route('/model-channels', modelChannelApp)
adminRouter.route('/models', modelApp)
adminRouter.route('/model-channel-bindings', modelChannelBindingApp)
adminRouter.route('/model-prices', modelPriceApp)

apiRouter.route('/admin', adminRouter)

export default apiRouter
