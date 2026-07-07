import { Hono } from 'hono'
import adminApp from './admin.route'
import chatApp from './chat.route'
import ragApp from './rag.route'
import userApp from './user.route'
import widgetApp from './widget.route'

const apiRouter = new Hono()

apiRouter.route('/users', userApp)
apiRouter.route('/rag', ragApp)
apiRouter.route('/admin', adminApp)
apiRouter.route('/widgets', widgetApp)
apiRouter.route('/chat', chatApp)

export default apiRouter
