/**
 * 🌟 核心基类：业务逻辑异常
 * 所有的自定义错误都应该继承它，外层的全局拦截器只认它
 */
export class BusinessException extends Error {
  public statusCode: number;
  public errorCode?: string; // 可选的内部错误码，比如 'USER_NOT_FOUND'

  constructor(message: string, statusCode: number = 400, errorCode?: string) {
    super(message);
    
    // 保持原型链的正确性（TypeScript 继承 Error 的标准操作）
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name; // 让控制台打印时显示真实的类名
    this.statusCode = statusCode;
    this.errorCode = errorCode;

    // 捕获堆栈跟踪，这会让你的错误日志精准定位到报错的那一行！
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 🍬 语法糖 1：资源未找到 (404)
 */
export class NotFoundException extends BusinessException {
  constructor(message: string = '请求的资源不存在', errorCode?: string) {
    super(message, 404, errorCode);
  }
}

/**
 * 🍬 语法糖 2：参数错误 (400)
 */
export class BadRequestException extends BusinessException {
  constructor(message: string = '请求参数错误', errorCode?: string) {
    super(message, 400, errorCode);
  }
}

/**
 * 🍬 语法糖 3：身份未授权 (401 - 通常用于没传 Token 或 Token 过期)
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = '身份认证失败，请先登录', errorCode?: string) {
    super(message, 401, errorCode);
  }
}

/**
 * 🍬 语法糖 4：权限不足 (403 - 通常用于有 Token，但级别不够，比如不是管理员)
 */
export class ForbiddenException extends BusinessException {
  constructor(message: string = '权限不足，拒绝访问', errorCode?: string) {
    super(message, 403, errorCode);
  }
}