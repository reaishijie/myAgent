import { Hono } from "hono";
import authApp from "./auth.route";
import userApp from "./user.route";

const apiRouter = new Hono()

apiRouter.route('/auth', authApp)
apiRouter.route('/users', userApp)

// 导出总路由接口
export default apiRouter
